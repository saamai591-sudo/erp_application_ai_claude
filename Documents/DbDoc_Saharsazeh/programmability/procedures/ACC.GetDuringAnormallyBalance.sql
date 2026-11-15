
------------------------------------------------------
 CREATE   PROCEDURE [ACC].GetDuringAnormallyBalance
 (
 @FinancialPeriodID INT,
 @CompanyID INT,
 @ToDate DATETIME
 )
 --WITH ENCRYPTION
WITH RECOMPILE
AS
SET NOCOUNT ON;

 BEGIN
 
	 DECLARE  
			@UserID INT,
			@DateType TINYINT,
			@DateFormat VARCHAR(10),
			@Columns nvarchar(max),
			@SelectQuery NVARCHAR(MAX),
			@JoinQuery NVARCHAR(MAX),
			@query nvarchar(max),
			@param nvarchar(max),
			@Culture NVARCHAR(20),
			@cultureNo INT;
	
		SET @Culture = CFG.GetuserCulture();
		SET @UserID = CFG.GetuserID();
	
		SELECT @CultureNo = CultureNo
		FROM CFG.CultureInfo 
		WHERE Culture = @Culture
		
	SELECT @DateType = us.SettingValue
	FROM CFG.UserSetting us
	WHERE us.SettingKey = 'Date_Type'
		  AND us.UserID = @UserID;
	
	IF @DateType IS NULL
		SET @DateType = CASE @Culture
							WHEN 'fa' THEN
								0
							WHEN 'en' THEN
								1
							WHEN 'ar' THEN
								2
						END;
	
	SELECT @DateFormat = us.SettingValue
	FROM CFG.UserSetting us
	WHERE us.SettingKey = 'Date_Format'
		  AND us.UserID = @UserID;
	
	IF @DateFormat IS NULL
		SET @DateFormat = 'YY/MM/DD';
		DECLARE @Debit NVARCHAR(100),
				@Credit NVARCHAR(100);
	
		SELECT @Debit = lev.Value
		FROM CFG.LocalizeEnum le
			JOIN CFG.LocalizeEnumValue lev
				ON lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE le.Enum = 'BalanceTypes'
			  AND le.Item = 'MooenDebtor'
			  AND lev.Culture = @Culture
	
		SELECT @Credit = lev.Value
		FROM CFG.LocalizeEnum le
			JOIN CFG.LocalizeEnumValue lev
				ON lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE le.Enum = 'BalanceTypes'
			  AND le.Item = 'TotalCreditor'
			  AND lev.Culture = @Culture;
	
	SELECT @SelectQuery
			= STUFF(
		(
			SELECT CASE
					   WHEN AccountLevelTypeID = 1 THEN
						   ',d' + CAST(AccountLevelID AS VARCHAR(10)) + '.Code AS ALCode'
						   + CAST(AccountLevelID AS VARCHAR(10)) + ',d' + CAST(AccountLevelID AS VARCHAR(10))
						   + '.Title AS ALTitle' + CAST(AccountLevelID AS VARCHAR(10)) 
					   ELSE
						   ',' + QUOTENAME(AccountLevelID) + ' as AL' + CAST(AccountLevelID AS VARCHAR(10))
				   END
			FROM ACC.AccountLevel
			FOR XML PATH(''), TYPE
		).value('.', 'NVARCHAR(MAX)'),
		1   ,
		0   ,
		''
				   );
	
	print @SelectQuery
		SELECT @JoinQuery
			= STUFF(
		(
			SELECT DISTINCT
				   ' Left Join acc.dl d' + CAST(AccountLevelID AS VARCHAR(10)) + ' on d'
				   + CAST(AccountLevelID AS VARCHAR(10)) + '.DlID = t.' + QUOTENAME(AccountLevelID)
			FROM ACC.AccountLevel
			WHERE AccountLevelTypeID = 1
			FOR XML PATH(''), TYPE
		).value('.', 'NVARCHAR(MAX)'),
		1   ,
		1   ,
		''
				   );
	
	
		SELECT @Columns = STUFF(
		(
			SELECT DISTINCT
				   ',' + QUOTENAME(al.AccountLevelID)
			FROM ACC.AccountLevel al
			FOR XML PATH(''), TYPE
		).value('.', 'NVARCHAR(MAX)'),
		1   ,
		1   ,
		'');
	
		IF @Columns IS NULL
		   OR @Columns = ''
			SET @Columns = '[-1]';
		
		drop table if exists ##AbnormallyBalanceMetaData
	
			set @Query = N' 
				SELECT  
					 v.Number
					,v.ReferenceNumber
					,v.[Date]
					,vi.SlID
					,vi.VoucherItemIndex
					,p.DLID
					,'+ @Columns +'
					,vi.Debit
					,vi.Credit
					,vi.Debit - vi.Credit AS Remain 
					,s.HasBalanceTypeCheck
					,s.SlBalanceTypeCode BalanceTypeID
					,vi.CurrencyID
	
					into ##AbnormallyBalanceMetaData
				from ACC.Voucher v
				JOIN CFG.Branch AS b
					 ON b.BranchID = v.BranchID
				INNER JOIN ACC.VoucherItem vi
					 ON vi.VoucherID = v.VoucherID
				INNER JOIN ACC.VWACCOUNTS s
					 ON s.SlID = vi.SlID
				LEFT JOIN (
							SELECT 
									a.VoucherItemID,
									a.AccountLevelID,
									a.DLID,
									case 
										when DLID	is not null then CAST(DLID as varchar(1024)) 
										else Value 
									end [Value]
							FROM ACC.AccountLevelVoucherItem a
							) x
				pivot(MAX([Value]) FOR AccountLevelID IN ('+@Columns+')) p
					ON p.VoucherItemID = vi.VoucherItemID
				WHERE v.FinancialPeriodID = @FinancialPeriodID
						AND b.CompanyID = @CompanyID             
						AND v.[Date] <= @ToDate
						AND s.SlBalanceTypeCode <> 15'
			print (@Query)
			SET @param = N'@FinancialPeriodID int, @CompanyID int, @ToDate date, @cultureNo int'
	
	EXECUTE sp_executeSQL  
				@Query,
				@param,
				@FinancialPeriodID=@FinancialPeriodID,
				@CompanyID = @CompanyID,
				@ToDate = @ToDate,
				@cultureNo = @cultureNo
	
	
	
	
	 DECLARE @TempTable VARCHAR(MAX);
	  SET @TempTable = CFG.getTempTableName(1);
	EXEC('
	select * into ' + @TempTable + ' 
			 from 
					(	select 
						ROW_NUMBER() over ( partition by CurrencyID,SlID,'+@Columns+' order by Number) RowNum,
						*
						from (  select        
										*,
										sum(Remain) over ( partition by CurrencyID,SlID,'+@Columns+' order by Number) running_total_remain
								from ##AbnormallyBalanceMetaData) abm
						where ((abm.BalanceTypeID = 13 AND abm.running_total_remain < 0)
						OR (abm.BalanceTypeID = 14 AND abm.running_total_remain > 0))
						AND abm.HasBalanceTypeCheck = 1
					)x
	where x.RowNum = 1
	
	--select * from ' + @TempTable+'' )
	
	set @Query = N'select 
							CASE @cultureNo
									WHEN 2 THEN c.Title2
									WHEN 1 THEN c.Title
								END AS CurrencyTitle
							,CASE @cultureNo
									WHEN 2 THEN s.SlTitle2
									WHEN 1 THEN s.SlTitle
								END AS SlTitle
							,s.SlCode
							'+ @SelectQuery +'
							,t.Number
							,t.ReferenceNumber
							,t.Date
							,CFG.GetCLRSaturnDate(t.[Date], @DateFormat, 0, @DateType) Date_Date
							,t.Remain
	from ' + @TempTable + ' t
	INNER JOIN CFG.Currency AS c
				ON c.CurrencyID = t.CurrencyID
	inner join ACC.vwaccounts s 
			on t.SlID = s.slid '+ ISNULL(@JoinQuery, '')
	
	
	print @Query
	SET @param = N'@cultureNo int, @DateType TINYINT, @DateFormat VARCHAR(10)'
	
	EXECUTE sp_executeSQL  
				@Query,
				@param,
				@cultureNo = @cultureNo,
				@DateFormat = @DateFormat,
				@DateType = @DateType


 END;
