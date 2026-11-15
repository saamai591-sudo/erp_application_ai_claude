
-------------------------------------
CREATE   PROCEDURE [ACC].spGetCloseTheAccountsForNonSelectedAccountGrid
(
    @FinicialPeriodID     INT,
    @CloseType            INT = NULL,
    @Date                 DATE = NULL,
    @BranchId             INT
)
--WITH ENCRYPTION
AS
BEGIN
	DECLARE @FStartDate     DATE,
	        @FEndDate       DATE;
	
	SELECT @FStartDate = fp.StartDate,
	       @FEndDate = fp.EndDate
	FROM   CFG.FinancialPeriod fp
	WHERE  fp.FinancialPeriodID = @FinicialPeriodID;
	
	DECLARE @AccontLevels           VARCHAR(MAX),
	        @AccountLevelTitles     NVARCHAR(MAX);
	
	DECLARE @NotTafsilALSelectList     VARCHAR(MAX),
	        @TafsilALSelectList        VARCHAR(MAX),
	        @TafsilALSJoinList         VARCHAR(MAX);
	
	DECLARE @Note INT = 2

	SELECT vi.Debit,
	       vi.Credit,
	       ACC.SlFullCode(s.SlID) AS FullCode,
	       s.Title,
	       vi.SlID,
	       vi.VoucherItemID,
	       vi.CurrencyID,
	       vi.CurrencyDebit,
	       vi.CurrencyCredit
	INTO   #T
	FROM   (
	           SELECT *
	           FROM   ACC.Voucher v
	           WHERE  [Date] BETWEEN @FStartDate AND @Date
	                  AND v.BranchID = @BranchId
	                  AND (
	                          (@CloseType = 2 AND v.DocumentTypeID <> 7)
	                          OR (@CloseType = 1 AND v.DocumentTypeID <> 7)
	                          OR (@CloseType = 3)
	                      )
	       ) v
	       INNER JOIN ACC.VoucherItem vi
	            ON  vi.VoucherID = v.VoucherID
	       INNER JOIN ACC.SL s --????
	            ON  s.SlID = vi.SlID
	       INNER JOIN ACC.SL s2 --??
	            ON  s2.SlID = Acc.[SlGroupId](s.SlID)
	      
	WHERE  v.VoucherStatusID <> @Note
	       AND (
	               @CloseType = 3
	               OR (@CloseType = 1 AND s2.BalanceTypeID = 4)
	               OR (@CloseType = 2 AND s2.BalanceTypeID = 2)
	           );	
	
	IF (
	       SELECT COUNT(*)
	       FROM   #T
	   ) = 0
	    RETURN;
	
	
	DECLARE @SelectQuery2        NVARCHAR(MAX),
	        @SelectQuery20       NVARCHAR(MAX),
	        @JoinQuery2          NVARCHAR(MAX),
	        @SelectQuery         NVARCHAR(MAX),
	        @SelectQueryTAll     NVARCHAR(MAX),
	        @Query               NVARCHAR(MAX),
	        @GroupByQuery        NVARCHAR(MAX),
	        @IStr                VARCHAR(2);
	
	SET @SelectQuery = '';
	SET @SelectQueryTAll = '';
	SET @GroupByQuery = '';
	SET @Query = '';
	SET @SelectQuery2 = '';
	SET @JoinQuery2 = '';
	
	SELECT @SelectQuery20 = STUFF(
	           (
	               SELECT DISTINCT
	                      ','
	                      + CASE 
	                             WHEN al.AccountLevelTypeID = 1 THEN QUOTENAME(al.AccountLevelID) + ' as ALDL'
	                                  + CAST(al.AccountLevelID AS VARCHAR(10))
	                             ELSE QUOTENAME(al.AccountLevelID) + ' as AL' + CAST(al.AccountLevelID AS VARCHAR(10))
	                        END
	               FROM   ACC.AccountLevel al
	               WHERE  al.AccountLevelTypeID = 1
	                      FOR XML PATH('') ,
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	SELECT @JoinQuery2 = STUFF(
	           (
	               SELECT DISTINCT
	                      ' Left outer join Acc.Dl Dl' + 
						  CAST(al.AccountLevelID AS VARCHAR(10)) +' ON Dl' +CAST(al.AccountLevelID AS VARCHAR(10)) +'.DlID =TAll.ALDL'+CAST(al.AccountLevelID AS VARCHAR(10))
	               FROM   ACC.AccountLevel al
	               WHERE  al.AccountLevelTypeID = 1
	                      FOR XML PATH('') ,
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );


	SELECT @SelectQuery2 = STUFF(
	           (
	               SELECT DISTINCT
	                      ' ,' + QUOTENAME('DL'+CAST(al.AccountLevelID AS VARCHAR(10))) + '.Code as ALDL' + CAST(al.AccountLevelID AS VARCHAR(10))+'_CODE,'
						  +QUOTENAME('DL'+ CAST(al.AccountLevelID AS VARCHAR(10))) + '.Title as ALDL' + CAST(al.AccountLevelID AS VARCHAR(10))+'_TITLE'
	               FROM   ACC.AccountLevel al
	               WHERE  al.AccountLevelTypeID = 1
	                      FOR XML PATH('') ,
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );

		  
	SELECT @SelectQuery = STUFF(
	           (
	               SELECT DISTINCT
	                      ', vial.ALDL' + CAST(al.AccountLevelID AS VARCHAR(10))
	               FROM   ACC.AccountLevel al
	               WHERE  al.AccountLevelTypeID = 1
	                      FOR XML PATH('') ,
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );

  
	SELECT @SelectQueryTAll = STUFF(
	           (
	               SELECT DISTINCT
	                      ', tAll.ALDL' + CAST(al.AccountLevelID AS VARCHAR(10))
	               FROM   ACC.AccountLevel al
	               WHERE  al.AccountLevelTypeID = 1
	                      FOR XML PATH('') ,
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );

	SELECT @GroupByQuery = STUFF(
	           (
	               SELECT DISTINCT
	                      ', vial.ALDL' + CAST(al.AccountLevelID AS VARCHAR(10))
	               FROM   ACC.AccountLevel al
	               WHERE  al.AccountLevelTypeID = 1
	                      FOR XML PATH('') ,
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );

	IF LEN(@SelectQuery) <> 0
	    SET @SelectQuery = SUBSTRING(@SelectQuery, 2, LEN(@SelectQuery));
	
	IF LEN(@SelectQuerytAll) <> 0
	    SET @SelectQuerytAll = SUBSTRING(@SelectQuerytAll, 2, LEN(@SelectQuerytAll));
	
	IF LEN(@SelectQuery2) <> 0
	    SET @SelectQuery2 = SUBSTRING(@SelectQuery2, 2, LEN(@SelectQuery2));
	
	
	IF LEN(@GroupByQuery) <> 0
	    SET @GroupByQuery = SUBSTRING(@GroupByQuery, 2, LEN(@GroupByQuery));
	
	
	PRINT @SelectQuery2
	DECLARE @Columns VARCHAR(MAX);
	SELECT @Columns = STUFF(
	           (
	               SELECT DISTINCT
	                      ',' + QUOTENAME(al.AccountLevelID)
	               FROM   ACC.AccountLevel al
	               WHERE  al.AccountLevelTypeID = 1
	                      FOR XML PATH('') ,
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       ); 
	
	
	IF @Columns IS NULL
	   OR @Columns = ''
	    SET @Query = 
	        '
            Select  Rno,SlID,FullCode,SlTitle,
            case when Debit>Credit then Debit-Credit Else 0 END as Debit,
            case when Credit>Debit then Credit-Debit Else 0 END as Credit,
             case when CurrencyDebit>CurrencyCredit then CurrencyDebit-CurrencyCredit Else 0 END as CurrencyDebit,
            case when CurrencyCredit>CurrencyDebit then CurrencyCredit-CurrencyDebit Else 0 END as CurrencyCredit,
            cfg.Currency.Title as CurrencyTitle,
            Cfg.Currency.CurrencyID
             from (            
	     Select 
	     CAST( ROW_NUMBER() OVER(ORDER BY T.SLID)  AS INT) AS Rno,
	    T.*,Acc.Sl.Title as SlTitle,
	    Acc.SlFullCode(T.SlID) as FullCode from (
			select SlID,
			
			
			CurrencyID,
			sum(debit) as Debit,
			sum(credit) as Credit,
			sum(Currencydebit) as CurrencyDebit,
			sum(Currencycredit) as CurrencyCredit
			 from #T
			 
			Group By SLID,CurrencyID having(sum(Currencydebit)-sum(Currencycredit)<>0)
			)T 
			 Inner join Acc.Sl
	      on Acc.Sl.SlID=T.SlID   ) TAll
	      Inner join Cfg.Currency on cfg.Currency.CurrencyID=TAll.CurrencyID';
	ELSE
	SET @Query = 
	    N'
	     Select  Rno,SlID,FullCode,SlTitle,Cfg.Currency.CurrencyID,
            case when Debit>Credit then Debit-Credit Else 0 END as Debit,
            case when Credit>Debit then Credit-Debit Else 0 END as Credit,
             case when CurrencyDebit>CurrencyCredit then CurrencyDebit-CurrencyCredit Else 0 END as CurrencyDebit,
            case when CurrencyCredit>CurrencyDebit then CurrencyCredit-CurrencyDebit Else 0 END as CurrencyCredit,
            cfg.Currency.Title as CurrencyTitle,
            ' + @SelectQuery2 + ',' + @SelectQueryTAll + 
	    ' 
             from (
	    Select 
	     CAST( ROW_NUMBER() OVER(ORDER BY T.SLID)  AS INT) AS Rno,
	    T.*,Acc.Sl.Title as SlTitle,
	    Acc.SlFullCode(T.SlID) as FullCode from (
			select SlID,
			CurrencyId,
			
			' + @SelectQuery + 
	    ',
			sum(debit) as Debit,sum(credit) as Credit,
			sum(Currencydebit) as CurrencyDebit,
			sum(Currencycredit) as CurrencyCredit from #T
			 left JOIN (
			 	
	      SELECT VoucherItemID,' + @SelectQuery20
	    + 
	    '  FROM 
	       (
	                SELECT alvi.VoucherItemID,
	                       alvi.AccountLevelID,
	                       CASE 
	                            WHEN DLID IS NOT NULL THEN  cast(DLID  as nvarchar(1024))
	                            WHEN DLID IS NULL THEN VALUE
	                       END VALUE
	                FROM Acc.AccountLevelVoucherItem alvi 
	                INNER JOIN Acc.AccountLevel al ON 
	                al.AccountLevelID = alvi.AccountLevelID
	                INNER JOIN Acc.VoucherItem vi ON vi.VoucherItemID = alvi.VoucherItemID
					INNER JOIN #T v ON v.VoucherItemID = vi.VoucherItemID
	            ) x
	            PIVOT(
	                MAX(VALUE)
	                FOR AccountLevelID IN (' + @Columns + 
	    ')
	            ) p
			 
			 ) vial
			ON #T.VoucherItemID=vial.VoucherItemID
			Group By SLID,CurrencyId , ' + @SelectQuery + 
	    ' 
			having(sum(Currencydebit)-sum(Currencycredit)<>0 or sum(debit) - sum(credit)<> 0)
			)T 
			 Inner join Acc.Sl
	      on Acc.Sl.SlID=T.SlID    )TAll ' + @JoinQuery2 + '  Inner join Cfg.Currency on cfg.Currency.CurrencyID=TAll.CurrencyID'  ;
	
	PRINT @Query;
	EXEC (@Query);
END;
