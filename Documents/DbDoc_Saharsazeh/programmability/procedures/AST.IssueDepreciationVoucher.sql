CREATE     PROCEDURE [AST].IssueDepreciationVoucher
    (
        @SubNumber NVARCHAR(256) ,
        @DepreciationCalculationID int ,
        @Date DATETIME ,
        @Number INT,
		@DocumentTypeId int
    )

--WITH ENCRYPTION 
AS
    DECLARE @userId INT ,
            @StartNum INT = NULL ,
            @EndNum INT = NULL ,
            @DailyNumber INT ,
            @ReferenceNumber INT ,
            @Message NVARCHAR(MAX) ,
            @CurrentDate DATETIME,
			@Description nvarchar(max),
			@Branch BIT = 0,
			@DocumentNumID int,
            @FinancialPeriodID int;

    select @FinancialPeriodID=p.FinancialPeriodID from ast.DepreciationCalculation dc
    join ast.DepreciationPeriod p on p.DepreciationPeriodID=dc.DepreciationPeriodID
    where dc.DepreciationCalculationID=@DepreciationCalculationID



    SET @CurrentDate = GETDATE();

    SET @userId = CFG.GetuserID();

    SELECT @Description = lsv.[Value]
    FROM   CFG.LocalizationSQLMessage ls
    JOIN CFG.LocalizationSQLMessageValue lsv
				 ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
    WHERE  ls.SQLMessageCode = 'DepreciationCostRecognition'
            AND lsv.Culture = CFG.GetuserCulture();



    IF EXISTS (   SELECT VoucherID
                  FROM   AST.DepreciationCalculation AS dc
                  WHERE dc.DepreciationCalculationID = @DepreciationCalculationID and   VoucherID IS NOT NULL )
        BEGIN

            SELECT @Message = 'ACC_spVoucherInsert_11' 
            RAISERROR(@Message, 16, 10);

            RETURN;
        END;

    IF @Date < (   SELECT dp.EndDate
                   FROM   AST.DepreciationCalculation AS dc
                   join ast.DepreciationPeriod AS dp on dp.DepreciationPeriodID = dc.DepreciationPeriodID
                   WHERE  dc.DepreciationCalculationID = @DepreciationCalculationID)
        BEGIN

            SELECT @Message = 'VoucherDateGreaterThanDocumentDate'

            RAISERROR(@Message, 16, 10);

            RETURN;
        END;


    DECLARE @ItemID INT ,
            @Plaque VARCHAR(MAX) ,
            @DltypeTitle NVARCHAR(250);

    DECLARE db_cursor CURSOR FOR
        SELECT DlTypeID
        FROM   ACC.UsedDlType
        WHERE  SaturnModuleID = 14;

    OPEN db_cursor;
    FETCH NEXT FROM db_cursor
    INTO @ItemID;

    WHILE @@FETCH_STATUS = 0
        BEGIN

            SELECT @Plaque = ',' + ISNULL(a.Plaque, '')
            FROM   AST.AssetSetting ast
                   JOIN AST.Asset a ON a.AssetID = ast.AssetID
            WHERE  AssetSettingID IN (   SELECT AssetSettingID
                                         FROM   AST.Depreciation d
                                         join ast.DepreciationCalculation dc on dc.DepreciationCalculationID = d.DepreciationCalculationID
                                         WHERE  dc.DepreciationCalculationID = @DepreciationCalculationID )
                   AND AssetSettingID NOT IN (   SELECT AssetSettingID
                                                 FROM   AST.AssetSettingDl
                                                 WHERE  DlTypeID = @ItemID );

            IF @Plaque IS NOT NULL
                BEGIN

                    SELECT @DltypeTitle = Title
                    FROM   ACC.DlType
                    WHERE  DlTypeID = @ItemID;
                    SET @Message = 'DetailInAssets' + @DltypeTitle 
                    RAISERROR(@Message, 16, 10);

                    RETURN;

                END;

            FETCH NEXT FROM db_cursor
            INTO @ItemID;
        END;

    CLOSE db_cursor;
    DEALLOCATE db_cursor;





    SELECT @StartNum = StartNum ,
           @EndNum = EndNum,
			@DocumentNumID = DocumentNumID
    FROM   CFG.DocumentNum
    WHERE  DocumentNumTypeID = 1
           AND FinancialPeriodID = @FinancialPeriodID;

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

	if exists (select 1 from ast.Depreciation d
               join ast.asset s on s.AssetID = d.AssetID
               join [AST].[FnFindCategoryAccount]() c on c.AssetCategoryID = s.AssetCategoryID
	           where s.DepreciationMethod <> 3 and
			        (c.[DepreciationCost] is null or c.[AccumulatedDepreciation] is null))
	begin

            SET @Message = 'DepreciationSlsNotSpecified'
            RAISERROR(@Message, 16, 10);
            RETURN;

	end


    DECLARE @Columns NVARCHAR(MAX) ,
            @Query NVARCHAR(MAX) ,
            @param NVARCHAR(MAX);

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
	    SlID INT not null ,
	    Debit DECIMAL(30,4) not null
	)

    SET @Query = N'
	alter TABLE #VoucherItemTemp
	add Credit DECIMAL(30,4) not null ' + @Columns + '
	';
    EXEC ( @Query );



    SELECT @Columns = STUFF(
    (   SELECT DISTINCT ',' + QUOTENAME(DlTypeID)
        FROM   ACC.UsedDlType
        WHERE  SaturnModuleID = 14
        FOR XML PATH(''), TYPE ).value('.', 'NVARCHAR(MAX)') ,
    1   ,
    1   ,
    ''  );

    IF ( @Columns IS NULL )
        SET @Columns = '[-1]';

    SET @Query = N'SELECT 1,row_number() over(order by BranchID) as RowIndex ,BranchID,slid,sum(debit),sum(credit),'+ @Columns+ '
	from (
	select
		a.BranchID,
		case when d.value > 0 then t.DepreciationCost else t.AccumulatedDepreciation end slid,
		abs(d.value) debit,0 credit,' + @Columns+ '
	from ast.Depreciation     d
	join ast.DepreciationCalculation dc on d.DepreciationCalculationID = dc.DepreciationCalculationID
	join ast.AssetSetting ass on d.AssetSettingID = ass.AssetSettingID
	join ast.Asset a on a.AssetID = ass.AssetID
	join [AST].[FnFindCategoryAccount]() t on t.AssetCategoryID = a.AssetCategoryID
	LEFT JOIN 
	(
	select AssetSettingID,asd.DlTypeID,d.DLID
	from ast.AssetSettingDl asd
	JOIN acc.Dl d ON asd.DlID = d.DLID 
	)x pivot
	(
	max(DLID)
	for DlTypeID in (' + @Columns+ ')
	)p on p.AssetSettingID = d.AssetSettingID 
	where dc.DepreciationCalculationID = '+CAST(@DepreciationCalculationID as NVARCHAR(250))+N'
	and d.value <> 0
	)A
	group by A.BranchID,
			 A.slid,
			'    + @Columns;

            --print @Query
            
    INSERT INTO #VoucherItemTemp
    EXEC ( @Query );



    DECLARE @RowIndex INT;

    SELECT @RowIndex = MAX(RowIndex)
    FROM   #VoucherItemTemp;

    SET @Query = N'SELECT 1,row_number() over(order by BranchID) + '
                 + CAST(@RowIndex AS VARCHAR(50))
                 + ' ,BranchID,slid,sum(debit),sum(credit) ,' + @Columns+ '
			from (
			select
		a.BranchID,
		case when d.value < 0 then t.DepreciationCost else t.AccumulatedDepreciation end slid,
		0 debit,abs(d.value) credit ,' + @Columns+ '	  		
	from ast.Depreciation     d
	join ast.DepreciationCalculation dc on d.DepreciationCalculationID = dc.DepreciationCalculationID
	join ast.AssetSetting ass on d.AssetSettingID = ass.AssetSettingID
	join ast.Asset a on a.AssetID = ass.AssetID
	join [AST].[FnFindCategoryAccount]() t on t.AssetCategoryID = a.AssetCategoryID
	LEFT JOIN 
	(
	select AssetSettingID,asd.DlTypeID,d.DLID
	from ast.AssetSettingDl asd
	JOIN acc.Dl d ON asd.DlID = d.DLID 
	)x pivot
	(
	max(DLID)
	for DlTypeID in (' + @Columns+ ')
	)p on p.AssetSettingID = d.AssetSettingID 
	where dc.DepreciationCalculationID = '+CAST(@DepreciationCalculationID as NVARCHAR(250))+N'
	and d.value <> 0
	)A
	group by BranchID,
			 slid,
		'        + @Columns;

    INSERT INTO #VoucherItemTemp
    EXEC ( @Query );




    DECLARE @MaxVoucherItem DECIMAL;

    SELECT @MaxVoucherItem = ISNULL(MAX(vi.VoucherItemID), 0)
    FROM   ACC.VoucherItem vi;

    UPDATE #VoucherItemTemp
    SET    VoucherItemID = @MaxVoucherItem + RowIndex;

	BEGIN TRY
    
        DECLARE @VoucherID INT ,
                @BranchID INT;

        SELECT   TOP 1 @BranchID = BranchID
        FROM     #VoucherItemTemp
        GROUP BY BranchID;
	
	    DECLARE @BranchIdCount INT;
	    
	    SELECT @BranchIdCount = COUNT(DISTINCT BranchID)
	    FROM   #VoucherItemTemp
	    
	    -- no depreciation rows to issue a voucher for (no asset is included in the calculation)
	    IF @BranchIdCount = 0
	    BEGIN
	          SET @Message = 'AssetManager.Messages.NoDepreciationForVoucher';
	        RAISERROR (@Message, 16, 10);
	    END;

	    IF @BranchIdCount > 1
	    BEGIN
	          SET @Message = 'Accounting.DifferentBranchDocuments';
	        RAISERROR (@Message, 16, 10);
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
	    END;	
	
	    IF EXISTS (
	                   SELECT 1
	                   FROM   ACC.Voucher v
				       join cfg.Branch b on v.BranchID = b.BranchID
	                   WHERE  v.Number = @Number
	                    AND v.FinancialPeriodID = @FinancialPeriodID
					    AND b.CompanyID = @CompanyID
				    )
	    BEGIN
	        RAISERROR ( 'NumberIsDuplicate' , 16, 13);
            return
	    END;

	    SET @ReferenceNumber = ISNULL(
	            (
	                SELECT MAX(ReferenceNumber)
	                FROM   [ACC].[Voucher] v
				    join cfg.Branch b on v.BranchID = b.BranchID
	                WHERE  v.FinancialPeriodID = @FinancialPeriodID
				    AND b.CompanyID = @CompanyID
	            ),0) + 1 ;
	



        SET @DailyNumber = ISNULL((   SELECT MAX(DailyNumber) + 1
                                      FROM   [ACC].[Voucher]
                                      WHERE  [Date] = @Date ) ,
                                  1);


        INSERT INTO ACC.Voucher ( BranchID ,
                                  FinancialPeriodID ,
                                  DocumentTypeID ,
                                  Number ,
                                  ReferenceNumber ,
                                  DailyNumber ,
                                  SubNumber ,
                                  Date ,
                                  VoucherStatusID ,
                                  [Description] ,
                                  Description2 ,
                                  Creator ,
                                  CreationDate ,
                                  Version ,
                                  LastEditor ,
                                  LastEditionDate ,
                                  Total,
							      [AutoGenerated] )
                    SELECT @BranchID ,
                           @FinancialPeriodID ,
                           @DocumentTypeId ,
                           @Number ,
                           @ReferenceNumber ,
                           @DailyNumber ,
                           @SubNumber ,
                           @Date ,
                           1 ,
                           @Description ,
                           @Description,
                           @userId ,
                           @CurrentDate ,
                           1 ,
                           @userId ,
                           @CurrentDate ,
                           0,
					       1


        SET @VoucherID = SCOPE_IDENTITY();

        UPDATE AST.DepreciationCalculation
        SET    VoucherID = @VoucherID
        WHERE DepreciationCalculationID = @DepreciationCalculationID;


        SET IDENTITY_INSERT ACC.VoucherItem ON;
        INSERT INTO [ACC].[VoucherItem] ( [VoucherItemID] ,
                                          [VoucherID] ,
                                          [VoucherItemIndex] ,
                                          [SlID] ,
                                          [Description] ,
                                          [Description2] ,
                                          [Debit] ,
                                          [Credit] ,
                                          [CurrencyID] ,
                                          [CurrencyRate] ,
                                          [CurrencyDebit] ,
                                          [CurrencyCredit] ,
                                          [Creator] ,
                                          [CreationDate] ,
                                          [LastEditor] ,
                                          [LastEditionDate] ,
                                          [Version] )
                    SELECT VoucherItemID ,
                           @VoucherID ,
                           RowIndex ,
                           SlID ,
                           @Description ,
                           @Description,
                           Debit ,
                           Credit ,
                           -1 ,
                           1 ,
                           Debit ,
                           Credit ,
                           @userId ,
                           @CurrentDate ,
                           @userId ,
                           @CurrentDate ,
                           0
                    FROM   #VoucherItemTemp;
        SET IDENTITY_INSERT ACC.VoucherItem OFF;



        UPDATE ACC.Voucher
        SET    Total = (   SELECT SUM(Debit)
                           FROM   ACC.VoucherItem vi
                           WHERE  vi.VoucherID = @VoucherID )
        WHERE  VoucherID = @VoucherID;

        DECLARE @DlTypeID INT;


        DECLARE db_cursor CURSOR FOR
            SELECT DlTypeID
            FROM   ACC.UsedDlType
            WHERE  SaturnModuleID = 14;

        OPEN db_cursor;
        FETCH NEXT FROM db_cursor
        INTO @DlTypeID;

        WHILE @@FETCH_STATUS = 0
            BEGIN

                SET @Query = N'
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
               ,' + QUOTENAME(@DlTypeID) + '
               ,null
               ,' + CAST(@userId AS VARCHAR(50))
                             + '
               ,@pCurrentDate
               ,' + CAST(@userId AS VARCHAR(50))
                             + '
                ,@pCurrentDate
               ,0
		       from #VoucherItemTemp v
		       join acc.AccountLevelSL s on s.SlID = v.slid and s.DlTypeID = '
                             + CAST(@DlTypeID AS VARCHAR(50));


                SET @param = N'@pCurrentDate date';

                EXECUTE sp_executesql @Query ,
                                      @param ,
                                      @pCurrentDate = @CurrentDate;



                FETCH NEXT FROM db_cursor
                INTO @DlTypeID;
            END;

        CLOSE db_cursor;
        DEALLOCATE db_cursor;


        EXEC ACC.ValidateVouchers @voucherIDs = @VoucherID ,                       -- nvarchar(max)
                                  @currentFinancialPeriodID = @FinancialPeriodID , -- int
                                  @isDelete = 0 ,                                  -- bit
                                  @voucherItemIds = DEFAULT;                       -- nvarchar(max)



	END TRY
	BEGIN CATCH

	    DECLARE @ErrorSeverity     INT,
			    @ErrorMessage2     NVARCHAR(MAX),
			    @ErrorState        INT;
		
		SET @ErrorSeverity = ERROR_SEVERITY();
		SET @ErrorMessage2 = ERROR_MESSAGE();
		SET @ErrorState = ERROR_STATE();
		
		RAISERROR (
		    @ErrorMessage2,	-- Message text.
		    @ErrorSeverity,	-- Severity,
		    @ErrorState,	-- State,
		    NULL,	-- First argument.
		    NULL
		); -- Second argument. 


	END CATCH; 


