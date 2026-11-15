------------------------------------- 
CREATE     PROCEDURE [AST].IssueInsuranceSharingVoucher
(
    @SubNumber          NVARCHAR(256),
    @ids   NVARCHAR(MAX),
    @FinancialPeriodID  INT,
    @Date DATETIME,
    @Number INT,
	@DocumentTypeId int
)

--WITH ENCRYPTION 
	 AS 
DECLARE     @userId                INT,	
			@StartNum         INT = NULL,
	        @EndNum           INT = NULL,
	        @DailyNumber      INT,
	        @ReferenceNumber  INT,
	        @Message          NVARCHAR(MAX),
	        @CurrentDate DATETIME,
			@Branch BIT = 0,
			@DocumentNumID int
	        
	        
	SET @CurrentDate=GETDATE()
	
	set @userId =  cfg.GetuserID()
	
	if  (select COUNT( distinct ass.BranchID) from ast.InsuranceSharing a
	join ast.AssetSetting b on a.AssetSettingID = b.AssetSettingID
	join AST.Asset ass on b.AssetID = ass.AssetID
	where InsuranceSharingID in (select value from cfg.R_FnCommaStr2Table(@ids))) <> 1
	begin 

	    set @Message = 'E_' + 'لازم است تمامی ردیفهای انتخاب شده متعلق به یک شعبه باشند.'
	    
	    RAISERROR(@Message, 16, 12)
	    
	    RETURN
	end


	if exists (select voucherid from ast.InsuranceSharing
	where InsuranceSharingID in (select value from cfg.R_FnCommaStr2Table(@ids))
	and VoucherID is not null)
	begin 

	    SELECT @Message = 'E_ACC_spVoucherInsert_11' 
	    
	    RAISERROR(@Message, 16, 12)
	    
	    RETURN
	end
		

	
		DECLARE @ItemID int, @Plaque varchar(max),@DltypeTitle nvarchar(250)
		
		DECLARE db_cursor CURSOR FOR
		select DlTypeID from acc.UsedDlType where SaturnModuleID = 14
				
		OPEN db_cursor   
		FETCH NEXT FROM db_cursor INTO @ItemID

		WHILE @@FETCH_STATUS = 0   
		BEGIN  
		
		select @Plaque = ',' + isnull(a.Plaque,'') from ast.AssetSetting ast
		join ast.asset a on a.AssetID = ast.AssetID
		where 
		AssetSettingID in  (
								select AssetSettingID from ast.InsuranceSharing
								where InsuranceSharingID in (select value from cfg.R_FnCommaStr2Table(@ids)))
			and
		AssetSettingID not in (
									select AssetSettingID from ast.AssetSettingDl
									where DlTypeID = @ItemID)
		 
		 if @Plaque is not null
		 begin

		 select @DltypeTitle = title from acc.DlType where DlTypeID = @ItemID
		 set @Message = 'E_' +'در پلاکهای زیر مقدار تفصیل '+@DltypeTitle +' مشخص نشده است.'
		  RAISERROR(@Message, 16, 12)

	      RETURN

		 end
		
		FETCH NEXT FROM db_cursor INTO @ItemID 
		END   

		CLOSE db_cursor   
		DEALLOCATE db_cursor
		
	

	IF (
	       SELECT COUNT(*)
	       FROM   ACC.Voucher v
	       WHERE  v.FinancialPeriodID = @FinancialPeriodID
	              AND v.DocumentTypeID = 3
	   ) <> 0
	BEGIN
	    SELECT @Message = 'E_ACC_spIssueVoucher_1' 
	    RAISERROR(@Message, 16, 12)
	    
	    RETURN
	END
	
	DECLARE @LatestConfirmedVoucherDate DATETIME = NULL
	SELECT TOP 1 @LatestConfirmedVoucherDate = v.[Date]
	FROM   Acc.Voucher v
	WHERE  v.VoucherStatusID = 4
	       AND v.FinancialPeriodID = @FinancialPeriodID
	ORDER BY
	       v.[Date] DESC
	
	
	IF (@Date < @LatestConfirmedVoucherDate)
	BEGIN
	    SELECT @Message = 'E_ACC_spVoucherInsert_2' 
	    
	    RAISERROR(@Message, 16, 12)
	    RETURN
	END
	
	
		if @Date < (select max(Date) from ast.InsuranceSharing
	where InsuranceSharingID in (select value from cfg.R_FnCommaStr2Table(@ids)))
	begin 

	    SELECT @Message = 'E_' + 'تاریخ سند نمی تواند کوچکتر از تاریخ محاسبه هزینه باشد.'
	    
	    RAISERROR(@Message, 16, 12)
	    
	    RETURN
	end
	
	SELECT @StartNum = StartNum,
	       @EndNum = EndNum,
			@DocumentNumID = DocumentNumID
	FROM   cfg.DocumentNum
	WHERE  DocumentNumTypeID = 1
	       AND FinancialPeriodID = @FinancialPeriodID
	
		IF EXISTS
		(
			SELECT 1
			FROM CFG.DocumentNumResetNumberBase a
			join [CFG].[DocumentNumResetNumberBaseType] b
				on a.DocumentNumResetNumberBaseTypeID = b.DocumentNumResetNumberBaseTypeID
			WHERE DocumentNumID = @DocumentNumID
			  AND b.EngName = 'Branch'
		)
		BEGIN
			SET @Branch = 1;
		END;	


	

	
	SET @DailyNumber = ISNULL(
	        (
	            SELECT MAX(DailyNumber) + 1
	            FROM   [ACC].[Voucher]
	            WHERE  [Date] = @Date
	        ),
	        1
	    )
	
	Declare @Columns nvarchar(max),
			@Query nvarchar(max),
			@param nvarchar(max)
	

    SELECT @Columns = STUFF(
    (   SELECT DISTINCT ',' + QUOTENAME(DlTypeID) + ' int not null'
        FROM   ACC.UsedDlType
        WHERE  SaturnModuleID = 14
        FOR XML PATH(''), TYPE ).value('.', 'NVARCHAR(MAX)') ,
    1   ,
    0   ,
    ''  );

    IF ( @Columns IS NULL )
        SET @Columns = ',[-1]  int ';

    IF OBJECT_ID('tempdb..#VoucherItemTemp') IS NOT NULL
        DROP TABLE #VoucherItemTemp;


	CREATE TABLE #VoucherItemTemp
	(
		VoucherItemID INT null,
		RowIndex INT null,
		BranchID int not null,
	    SlID INT  null ,
		DlID int null,
		InsuranceType nvarchar(max),
	    Debit DECIMAL(30,4) not null
	)

    SET @Query = N'
	alter TABLE #VoucherItemTemp
	add Credit DECIMAL(30,4) not null ' + @Columns + '
	';
    EXEC ( @Query );


		
	select @Columns = STUFF((SELECT DISTINCT ',' + QUOTENAME(DlTypeID) 
									FROM acc.UsedDlType  WHERE SaturnModuleID = 14
									FOR XML PATH(''), TYPE
								   ).value('.', 'NVARCHAR(MAX)'),1,1,'')
								   
	if(@Columns is null)
	set @Columns = '[-1]'

	SET @Query = N'SELECT   1,row_number() over(order by a.BranchID) as RowIndex ,
							a.BranchID,
							ity.InsuranceCost,
							pa.dlid,
							ity.title,
							case when  sum(d.SharingValue) > 0 then sum(d.SharingValue) else 0 end,
							case when  sum(d.SharingValue) > 0 then 0 else sum(d.SharingValue) end,
							'+@Columns+'
					from ast.InsuranceSharing     d
					join ast.AssetSetting ass on d.AssetSettingID = ass.AssetSettingID
					join ast.Asset a on a.AssetID = ass.AssetID
					join ast.InsuranceItem it on it.InsuranceItemID = d.InsuranceItemID
					join ast.Insurance i on it.InsuranceID = i.InsuranceID
					join cfg.party pa on pa.partyid = i.partyid
					join ast.InsuranceType ity on ity.InsuranceTypeID = i.InsuranceTypeID
					LEFT JOIN 
					(
					select AssetSettingID,asd.DlTypeID,d.DLID
					from ast.AssetSettingDl asd
					JOIN acc.Dl d ON asd.DlID = d.DLID 
					)x pivot
					(
					max(DLID)
					for DlTypeID in ('+@Columns+')
					)p on p.AssetSettingID = d.AssetSettingID 
					where d.InsuranceSharingID in (select value from cfg.R_FnCommaStr2Table('''+@ids+'''))
					group by a.BranchID,
						ity.InsuranceCost,pa.dlid,
						ity.title,
						'+@Columns

insert into #VoucherItemTemp
exec (@Query)
declare @RowIndex int = @@ROWCOUNT



if exists (select * from #VoucherItemTemp where debit = 0 and credit = 0)
begin

set @message = 'E_'+'مقدار هزینه بیمه در ردیفهای انتخاب شده صفر است.'
    RAISERROR (@message, 16, 12);
	    RETURN

end



if exists (select * from #VoucherItemTemp where SlID is null)
begin

	select top 1 @message = 'در نوع بیمه '+InsuranceType+' معین هزینه بیمه مشخص نشده است.'
	from #VoucherItemTemp where SlID is null
    RAISERROR (@message, 16, 12);
	RETURN

end



	SET @Query = N'SELECT   1,row_number() over(order by a.BranchID) + '+cast(@RowIndex as varchar(50))+' ,
							a.BranchID,
							ity.PrepaidInsurance,
							pa.dlid,
							ity.title,
							case when  sum(d.SharingValue) > 0 then 0 else sum(d.SharingValue)  end,
							case when  sum(d.SharingValue) > 0 then sum(d.SharingValue)  else 0 end,
							'+@Columns+'	  		
					from ast.InsuranceSharing     d
					join ast.AssetSetting ass on d.AssetSettingID = ass.AssetSettingID
					join ast.Asset a on a.AssetID = ass.AssetID
					join ast.InsuranceItem it on it.InsuranceItemID = d.InsuranceItemID
					join ast.Insurance i on it.InsuranceID = i.InsuranceID
					join cfg.party pa on pa.partyid = i.partyid
					join ast.InsuranceType ity on ity.InsuranceTypeID = i.InsuranceTypeID
					LEFT JOIN 
					(
					select AssetSettingID,asd.DlTypeID,d.DLID
					from ast.AssetSettingDl asd
					JOIN acc.Dl d ON asd.DlID = d.DLID 
					)x pivot
					(
					max(DLID)
					for DlTypeID in ('+@Columns+')
					)p on p.AssetSettingID = d.AssetSettingID 
					where d.InsuranceSharingID in (select value from cfg.R_FnCommaStr2Table('''+@ids+'''))
					group by a.BranchID,
						ity.PrepaidInsurance,pa.dlid,
						ity.title,
						'+@Columns

insert into #VoucherItemTemp
exec (@Query)


if exists (select * from #VoucherItemTemp where SlID is null)
begin

	select top 1 @message = 'در نوع بیمه '+InsuranceType+' معین پیش پرداخت بیمه مشخص نشده است.'
	from #VoucherItemTemp where SlID is null
    RAISERROR (@message, 16, 12);
	RETURN

end	   
	
	DECLARE @MaxVoucherItem DECIMAL
	
	SELECT @MaxVoucherItem=ISNULL(MAX(vi.VoucherItemID),0)
	FROM acc.VoucherItem vi

	update #VoucherItemTemp
	set VoucherItemID = @MaxVoucherItem + RowIndex
	

	declare @VoucherID int,
			@BranchID int

	select top 1 @BranchID = BranchID
		from #VoucherItemTemp
	group by BranchID
		
	    DECLARE @BranchIdCount INT;
	    
	    SELECT @BranchIdCount = COUNT(DISTINCT BranchID)
	    FROM   #VoucherItemTemp
	    
	    IF @BranchIdCount <> 1
	    BEGIN
	          SET @Message = 'Accounting.DifferentBranchDocuments';
	        RAISERROR (@Message, 16, 10);
			RETURN
	    END;

	DECLARE @CompanyID int
	select @CompanyID = CompanyID
	from cfg.Branch
	where BranchID = @BranchID

	IF @Number = 0
	    SET @Number = ISNULL(
	            (
	                SELECT MAX(Number) + 1
	                FROM   [ACC].[Voucher] v
					join cfg.Branch b on v.BranchID = b.BranchID
					WHERE  v.FinancialPeriodID = @FinancialPeriodID
					AND b.CompanyID = @CompanyID
	            ),
	            @StartNum
	        );

	IF (
	       @Number < @StartNum
	       OR (@EndNum IS NOT NULL AND @Number > @EndNum)
	   )
	BEGIN
	  
	    RAISERROR ('InvalidNumberRange', 16, 13);
		RETURN
	END;	


	declare @Count int = 0
	SELECT @Count = COUNT(1)
	FROM   ACC.Voucher v
	join cfg.Branch b on v.BranchID = b.BranchID
	WHERE  v.Number = @Number
	AND v.FinancialPeriodID = @FinancialPeriodID
	AND b.CompanyID = @CompanyID
	
	IF  @Count > 0
	BEGIN
	    RAISERROR ( 'NumberIsDuplicate' , 16, 12);
		RETURN
	END;

	SET @ReferenceNumber = ISNULL(
	        (
	            SELECT MAX(ReferenceNumber) + 1
	            FROM   [ACC].[Voucher] v
				join cfg.Branch b on v.BranchID = b.BranchID
	            WHERE  v.FinancialPeriodID = @FinancialPeriodID
				AND b.CompanyID = @CompanyID
	        ),1);
	

	INSERT INTO Acc.Voucher
	  (
	    BranchID,
	    FinancialPeriodID,
	    DocumentTypeID,
	    Number,
	    ReferenceNumber,
	    DailyNumber,
	    SubNumber,
	    Date,
	    VoucherStatusID,
	    [Description],
	    Description2,
	    Creator,
	    CreationDate,
	    Version,
	    LastEditor,
	    LastEditionDate,
	    Total,
		[AutoGenerated]
	  )
	SELECT @BranchID,
	       @FinancialPeriodID,
	       @DocumentTypeId,
	       @Number,
	       @ReferenceNumber,
	       @DailyNumber,
	       @SubNumber,
	       @Date,
	       1,
	       'بابت شناسایی هزینه بیمه محقق شده',
	       'بابت شناسایی هزینه بیمه محقق شده',
	       @userId,
	       @CurrentDate,
	       1,
	       @userId,
	       @CurrentDate,
	       0,
		   1
	
		
	SET @VoucherID = SCOPE_IDENTITY()

	update ast.InsuranceSharing
	set voucherid = @VoucherID
	where InsuranceSharingID in (select value from cfg.R_FnCommaStr2Table(@ids))


    SET IDENTITY_INSERT Acc.VoucherItem  on 
	         INSERT INTO [ACC].[VoucherItem]
           ([VoucherItemID]
		   ,[VoucherID]
           ,[VoucherItemIndex]
           ,[SlID]
           ,[Description]
           ,[Description2]
           ,[Debit]
           ,[Credit]
           ,[CurrencyID]
           ,[CurrencyRate]
           ,[CurrencyDebit]
           ,[CurrencyCredit]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version])
		   select 
		   VoucherItemID
		   ,@VoucherID
           ,RowIndex
           ,SlID
           ,'بابت شناسایی هزینه بیمه محقق شده'
           , 'بابت شناسایی هزینه بیمه محقق شده'
           ,Debit
           ,Credit
           ,-1
           ,1
           ,Debit
           ,Credit
           ,@userId
           ,@CurrentDate
           ,@userId
           ,@CurrentDate
           ,0
		   from #VoucherItemTemp
	SET IDENTITY_INSERT Acc.VoucherItem  Off         
	

	
	
	UPDATE acc.Voucher
	SET  Total=(SELECT SUM(debit) FROM acc.VoucherItem vi
	            WHERE vi.VoucherID=@VoucherID)
	WHERE VoucherID=@VoucherID

		DECLARE @DlTypeID int
		
		DECLARE db_cursor CURSOR FOR
		select DlTypeID
		FROM acc.UsedDlType  WHERE SaturnModuleID = 14
				
		OPEN db_cursor   
		FETCH NEXT FROM db_cursor INTO @DlTypeID

		WHILE @@FETCH_STATUS = 0   
		BEGIN  
	
		set @Query = N'
		INSERT INTO [ACC].[AccountLevelVoucherItem]
           ([VoucherItemID]
           ,[AccountLevelID]
           ,[DlID]
           ,[Value]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version])
		select [VoucherItemID]
           ,[AccountLevelID]
           ,'+QUOTENAME(@DlTypeID)+'
           ,null
           ,'+cast (@userId as varchar(50))+'
           ,@pCurrentDate
           ,'+cast (@userId as varchar(50))+'
            ,@pCurrentDate
           ,0
		   from #VoucherItemTemp v
		   join acc.AccountLevelSL s on s.SlID = v.slid and s.DlTypeID = '+cast (@DlTypeID as varchar(50))


		SET @param = N'@pCurrentDate date'

		EXECUTE sp_executeSQL  
					@query,
					@param,
					@pCurrentDate = @CurrentDate

		
		FETCH NEXT FROM db_cursor INTO @DlTypeID 
		END   

		CLOSE db_cursor   
		DEALLOCATE db_cursor

		INSERT INTO [ACC].[AccountLevelVoucherItem]
           ([VoucherItemID]
           ,[AccountLevelID]
           ,[DlID]
           ,[Value]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version])
		select 
			[VoucherItemID]
           ,[AccountLevelID]
           ,dlid
           ,null
           ,@userId
           ,@CurrentDate
           ,@userId
           ,@CurrentDate
           ,0
		   from #VoucherItemTemp v
		   join acc.AccountLevelSL s on s.SlID = v.slid and s.DlTypeID = 28

	IF OBJECT_ID('#VoucherItemTemp') IS NOT NULL 
	DROP TABLE #VoucherItemTemp

