
---------Start of #NoTask
CREATE   PROCEDURE [ACC].GetFinalOperationAbnormallyBalance
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
		@cultureNo INT,
		@RemainInLine decimal(30,4) = 0;
		
			SET @Culture = CFG.GetuserCulture();
		
			SELECT @CultureNo = CultureNo
			FROM CFG.CultureInfo 
			WHERE Culture = @Culture
		
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
				   WHEN AccountLevelTypeID = 2
						OR AccountLevelTypeID = 3 THEN
					   ',' + 'cast(' + QUOTENAME(AccountLevelID)
					   + ' as decimal(30,4)) * case when Credit>0 then -1.0000 Else 1.0000 END  as AL'
					   + CAST(AccountLevelID AS VARCHAR(10))
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
						ROW_NUMBER() OVER (PARTITION BY vi.SlID ORDER BY v.Number) AS RowNum
						,v.Number
						,vi.SlID
						,vi.VoucherItemIndex
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
							AND s.SlBalanceTypeCode <> 15
							and v.VoucherStatusID <> 2
							'
				print (@Query)
				SET @param = N'@FinancialPeriodID int, @CompanyID int, @ToDate date, @cultureNo int'
		
		EXECUTE sp_executeSQL  
					@Query,
					@param,
					@FinancialPeriodID=@FinancialPeriodID,
					@CompanyID = @CompanyID,
					@ToDate = @ToDate,
					@cultureNo = @cultureNo
		
		DECLARE @TempTable1 VARCHAR(MAX);
		  SET @TempTable1 = CFG.getTempTableName(1);
		
		set @Query = 'select 
							a.* 
							into ' + @TempTable1 + '
						from 
						(select 
								CurrencyID
								,SlID
								,'+ @Columns +'
								,SUM(debit)-SUM(credit) Remain
								from  ##AbnormallyBalanceMetaData
						group by CurrencyID,SlID,'+ @Columns +') a
						join ACC.SL AS sl
								on a.SlID = sl.SlID
						JOIN ACC.BalanceType bt 
								on sl.BalanceTypeID = bt.BalanceTypeID
						where (bt.BalanceTypeID = 13 AND a.Remain < 0)
							OR(bt.BalanceTypeID = 14 AND a.remain > 0) '
		--print @Query
		exec(@Query)
		
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
								,t.Remain
		from ' + @TempTable1 + ' t
		INNER JOIN CFG.Currency AS c
					ON c.CurrencyID = t.CurrencyID
		inner join ACC.vwaccounts s 
				on t.SlID = s.slid '+ ISNULL(@JoinQuery, '')
		
		
		--print @Query
		SET @param = N'@cultureNo int'
		
		EXECUTE sp_executeSQL  
					@Query,
					@param,
					@cultureNo = @cultureNo
		 
END;
