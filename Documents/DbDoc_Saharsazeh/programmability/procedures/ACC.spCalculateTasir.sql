-------------------------------------
CREATE   PROCEDURE [ACC].spCalculateTasir
(
    @FinicialPeriodID INT,
    @ToDate DATE, --time
    @BranchId INT,
    @currencyId INT,
    @CurrencyRate DECIMAL(36, 10)
)

--WITH ENCRYPTION
AS
BEGIN

    DECLARE @CurrencyTitle NVARCHAR(250),
            @msg NVARCHAR(MAX);

    if EXISTS (
	    SELECT 1 FROM acc.AccCurrencyExchange c
	    LEFT JOIN (
				    SELECT VoucherID,PrevoucherID FROM acc.VoucherPrevoucher
				    GROUP BY VoucherID,PrevoucherID
	    ) vp ON vp.PrevoucherID = c.PreVoucherID
	    WHERE (c.PreVoucherID IS NULL OR vp.VoucherID IS NULL)
	    AND c.CurrencyID = @currencyId)
	BEGIN
		    SELECT @CurrencyTitle = Title FROM cfg.Currency WHERE CurrencyID = @currencyId
            SET @msg = N'برای ارز ' + @CurrencyTitle + N' قبلا محاسبه تسعیری انجام شده که فاقد سند حسابداری است. ابتدا آن تسعیر را تعیین وضعیت نمایید.';
            RAISERROR(@msg, 16, 13);
	END;
			
    SELECT *
    INTO #Voucher
    FROM ACC.Voucher v
    WHERE v.FinancialPeriodID = @FinicialPeriodID
          AND v.Date <= @ToDate
          AND v.BranchID = @BranchId
          AND v.VoucherStatusID <> 2;
		  
    SELECT c.CurrencyID,
           c.ExchangeUnit,
           c.PrecisionCount,
           @CurrencyRate AS Rate,
           c.Title,
           c.IsBaseCurrencyBasis
    INTO #Currency
    FROM CFG.Currency c
    WHERE c.CurrencyID = @currencyId;


    SELECT v.Number,
           vi.Debit,
           vi.Credit,
           ACC.SlFullCode(s.SlID) AS FullCode,
           s.Title SlTitle,
           vi.VoucherItemID,
           vi.SlID,
           vi.CurrencyID,
           c.Title CurrencyTitle,
           CASE
               WHEN v.DocumentTypeID = 6 THEN
                   0
               ELSE
                   vi.CurrencyDebit
           END CurrencyDebit,
           CASE
               WHEN v.DocumentTypeID = 6 THEN
                   0
               ELSE
                   vi.CurrencyCredit
           END CurrencyCredit,
           CAST(CASE c.IsBaseCurrencyBasis
                    WHEN 0 THEN
                        c.Rate
                    ELSE
                        1 / c.Rate
                END / c.ExchangeUnit AS DECIMAL(36, 10)) Rate
    INTO #T
    FROM #Voucher v
        JOIN ACC.VoucherItem vi
            ON vi.VoucherID = v.VoucherID
        JOIN ACC.SL s
            ON s.SlID = vi.SlID
        JOIN #Currency c
            ON c.CurrencyID = vi.CurrencyID
    WHERE s.HasCurrencyConversion = 1;
	   
    IF NOT EXISTS (SELECT COUNT(1)FROM #T)
    BEGIN

        RETURN 0;
    END;

    DECLARE @SelectQuery2 NVARCHAR(MAX),
            @SelectQuery3 NVARCHAR(MAX),
            @JoinQuery2 NVARCHAR(MAX),
            @SelectQuery NVARCHAR(MAX),
            @Query NVARCHAR(MAX),
            @GroupByQuery NVARCHAR(MAX),
            @IStr NVARCHAR(20),
            @Columns VARCHAR(MAX);


    SELECT @Columns = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME(al.AccountLevelID)
        FROM ACC.AccountLevel al
        WHERE al.AccountLevelTypeID = 1
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                           );


    SELECT @SelectQuery3 = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME(al.AccountLevelID) + ' as AL' + CAST(al.AccountLevelID AS VARCHAR(10))
        FROM ACC.AccountLevel al
        WHERE al.AccountLevelTypeID = 1
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                                );

    SET @SelectQuery = N'';
    SET @Query = N'';
    SET @SelectQuery2 = N'';
    SET @JoinQuery2 = N'';
	
    SELECT @SelectQuery2 = STUFF(
    (
        SELECT DISTINCT
				 N',  DL' + CAST(al.AccountLevelID AS VARCHAR(10)) + N'.Code as ALCode' + CAST(al.AccountLevelID AS VARCHAR(10)) + 
				 N', DL' + CAST(al.AccountLevelID AS VARCHAR(10))              + N'.Title as ALTitle' + CAST(al.AccountLevelID AS VARCHAR(10))
        FROM ACC.AccountLevel al
        WHERE al.AccountLevelTypeID = 1
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    '');

	if(@SelectQuery2 is null )
	 SET @SelectQuery2 = N'';
	
    SELECT @JoinQuery2 = STUFF(
    (
        SELECT DISTINCT
				N' Left outer join Acc.Dl Dl' + CAST(al.AccountLevelID AS VARCHAR(10)) + N' on Dl' + CAST(al.AccountLevelID AS VARCHAR(10)) + N'.DlID=T.AL' + CAST(al.AccountLevelID AS VARCHAR(10)) + N' '
        FROM ACC.AccountLevel al
        WHERE al.AccountLevelTypeID = 1
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    '');
	
	if(@JoinQuery2 is null )
	 SET @JoinQuery2 = N'';

	SELECT @SelectQuery = STUFF(
    (
        SELECT DISTINCT
				 N', AL' +  CAST(al.AccountLevelID AS VARCHAR(10)) 
        FROM ACC.AccountLevel al
        WHERE al.AccountLevelTypeID = 1
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    '');

	if(@SelectQuery is null )
	 SET @SelectQuery = N'';

    SELECT @GroupByQuery = STUFF(
    (
        SELECT DISTINCT
               ',vial.' + QUOTENAME(al.AccountLevelID)
        FROM ACC.AccountLevel al
        WHERE al.AccountLevelTypeID = 1
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    '');

    IF (@GroupByQuery IS NULL)
        SET @GroupByQuery = N'';

    IF LEN(@SelectQuery) <> 0
        SET @SelectQuery = SUBSTRING(@SelectQuery, 2, LEN(@SelectQuery));

    IF LEN(@SelectQuery2) <> 0
        SET @SelectQuery2 = SUBSTRING(@SelectQuery2, 2, LEN(@SelectQuery2));

    DECLARE @tableName NVARCHAR(100) = CFG.getTempTableName(1),
            @BasePrecision VARCHAR(10) = CFG.GetBaseCurrencyPrecision();

    SET @Query
        = N'Select *   
	into ' + @tableName
          + N'
	from(	
	 select cast( Row_number() over(order by SlID) as int) as Rno, *,	  
			Round((CurrencyDebitRemain*Rate),' + @BasePrecision + N') as TasirDebitRemain, 
			Round((CurrencyCreditRemain*Rate),' + @BasePrecision + N') as TasirCreditRemain,
			(case when 	Round((CurrencyDebitRemain*Rate),' + @BasePrecision
          + N') - DebitRemain >0 
				  then  Round((CurrencyDebitRemain*Rate),' + @BasePrecision
          + N') - DebitRemain 
				+ (
					 case when 	Round((CurrencyCreditRemain*Rate),' + @BasePrecision
          + N') - CreditRemain <0
					 then  CreditRemain-	Round((CurrencyCreditRemain*Rate),' + @BasePrecision
          + N')
					 Else 0 END 
				  )
				Else 0 +
				  (
					 case when 	Round((CurrencyCreditRemain*Rate),' + @BasePrecision
          + N') - CreditRemain <0
					 then  CreditRemain - Round((CurrencyCreditRemain*Rate),' + @BasePrecision
          + N') 
					 Else 0 END 
				  )
				 END ) as DiffDebit,	        
	        (case when 	Round((CurrencyCreditRemain*Rate),' + @BasePrecision
          + N') - CreditRemain >0 
	              then  Round((CurrencyCreditRemain*Rate),' + @BasePrecision
          + N') - CreditRemain
	        + (
					 case when 	Round((CurrencyDebitRemain*Rate),' + @BasePrecision
          + N') - DebitRemain <0
					      then  DebitRemain-Round((CurrencyDebitRemain*Rate),' + @BasePrecision
          + N')
					 else 0 END  
	          )
	        Else 0
	        + (
					 case when 	Round((CurrencyDebitRemain*Rate),' + @BasePrecision
          + N') - DebitRemain <0
					      then  DebitRemain - Round((CurrencyDebitRemain*Rate),' + @BasePrecision
          + N') else 0 END  ) END ) as DiffCredit    
	 from (
		select 
				T.SlID,
				FullCode,
				SlTitle,
				CurrencyTitle,	    
				T.CurrencyID,' + @SelectQuery2 + N',' + @SelectQuery
          + N',
				Rate,
				Debit,
				Credit,
				case when  debit-Credit>0 then debit-Credit else 0 end as DebitRemain,
				case when  Credit-debit>0 then  Credit-debit else 0 end as CreditRemain,
				CurrencyDebit,
				CurrencyCredit,
				case when  Currencydebit-CurrencyCredit>0 then Currencydebit-CurrencyCredit else 0 end as CurrencyDebitRemain,
				case when  CurrencyCredit-Currencydebit>0 then  CurrencyCredit-Currencydebit else 0 end as CurrencyCreditRemain
			from (
				select 
						SLID,
						FullCode,
						SlTitle,
						CurrencyID,
						CurrencyTitle,
						Rate,' + @SelectQuery3
          + N',
						sum(CurrencyDebit) as CurrencyDebit,
						sum(CurrencyCredit) as CurrencyCredit,
						sum(debit) as debit,
						sum(credit) as credit
	
				from  (	SELECT v.VoucherItemID,SLID,FullCode,SlTitle,CurrencyID,CurrencyTitle,Rate,CurrencyDebit,CurrencyCredit,debit,credit,alvi.AccountLevelID,
										   CASE 
											   WHEN DLID IS NOT NULL THEN CAST( DLID AS NVARCHAR(2048))
												WHEN DLID IS NULL THEN VALUE
										   END VALUE
									FROM #T v 
									left JOIN  Acc.AccountLevelVoucherItem alvi  ON v.VoucherItemID = alvi.VoucherItemID
								) x
								PIVOT(
									MAX(VALUE)
									FOR AccountLevelID IN (' + @Columns
          + N')			
						  ) vial 		
				Group by SLID,FullCode,SlTitle,CurrencyID,CurrencyTitle,Rate,' + @GroupByQuery + N'
					)T
	      ' + @JoinQuery2 + N'	      
	)T2 )T20 where DiffCredit<>0 OR DiffDebit<>0';

    EXEC (@Query);

    SET @Query = N'select * from ' + @tableName;
    EXEC sys.sp_executesql @Query;

END;
