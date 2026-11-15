CREATE   PROC [ACC].ValidateVouchers
(
    @voucherIDs NVARCHAR(MAX),
    @currentFinancialPeriodID INT,
    @isDelete BIT,
    @voucherItemIds NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
BEGIN

DECLARE @baseCurrenncyPercisionCount INT

    SELECT @baseCurrenncyPercisionCount = c.PrecisionCount
    FROM CFG.Currency AS c
    WHERE c.CurrencyID = -1;


    SELECT rfcst.value
    INTO #voucherIds
    FROM CFG.R_FnCommaStr2Table(@voucherIDs) AS rfcst;

    SELECT rfcst.value AS VoucherItemId
    INTO #voucherItemIds
    FROM CFG.R_FnCommaStr2Table(@voucherItemIds) AS rfcst;

    DECLARE @fromDate DATE,
            @toDate DATE,
            @Message NVARCHAR(MAX);

    SELECT @fromDate = fp.StartDate,
           @toDate = fp.EndDate
    FROM CFG.FinancialPeriod AS fp
    WHERE fp.FinancialPeriodID = @currentFinancialPeriodID;

    SELECT v.Number,
           v.DocumentTypeID,
           v.Date,
           v.FinancialPeriodID,
           v.VoucherStatusID,
           v.VoucherID,
           v.BranchID,
           b.CompanyID
    INTO #ValidateVoucherHeaders
    FROM ACC.Voucher AS v
        JOIN #voucherIds AS vi
            ON v.VoucherID = vi.value
        JOIN CFG.Branch AS b
            ON b.BranchID = v.BranchID;

    IF EXISTS
    (
        SELECT 1
        FROM #ValidateVoucherHeaders
        WHERE FinancialPeriodID <> @currentFinancialPeriodID
    )
    BEGIN
        RAISERROR(N'InvalidFinancialPeriodEdit', 16, 12);
        RETURN 0;
    END;

    DECLARE @StartNum INT = NULL,
            @EndNum INT = NULL;

    SELECT @StartNum = StartNum,
           @EndNum = EndNum
    FROM CFG.DocumentNum
    WHERE DocumentNumTypeID = 1
          AND FinancialPeriodID = @currentFinancialPeriodID;

    IF EXISTS
    (
        SELECT 1
        FROM ACC.Voucher AS v
            JOIN CFG.Branch AS b
                ON b.BranchID = v.BranchID
        WHERE v.FinancialPeriodID = @currentFinancialPeriodID
        GROUP BY v.Number,
                 b.CompanyID
        HAVING COUNT(1) > 1
    )
    BEGIN
        RAISERROR(N'Accounting.DuplicateVoucherNumber', 16, 12);
        RETURN 0;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM ACC.Voucher AS v
            JOIN #voucherIds AS vi
                ON v.VoucherID = vi.value
        WHERE (
                  @EndNum IS NULL
                  OR v.Number NOT
              BETWEEN @StartNum AND @EndNum
              )
              AND
              (
                  @EndNum IS NOT NULL
                  OR v.Number < @StartNum
              )
    )
    BEGIN
        RAISERROR(N'InvalidNumberRange', 16, 12);
        RETURN 0;
    END;

    SELECT src.VoucherID,
           v2.Number
    INTO #voucherPrevoucherDateIssue
    FROM
    (
        SELECT v.VoucherID,
               MAX(pv.Date) preVoucherDate,
               MAX(v.Date) VoucherDate
        FROM ACC.VoucherPrevoucher AS vp
            JOIN ACC.PreVoucher AS pv
                ON pv.PreVoucherID = vp.PrevoucherID
            JOIN ACC.VoucherPrevoucher AS vp2
                ON vp2.PrevoucherID = pv.PreVoucherID
                   AND vp2.PrevoucherItemID = vp.PrevoucherItemID
            JOIN ACC.Voucher AS v
                ON v.VoucherID = vp.VoucherID
        GROUP BY v.VoucherID
    ) src
        JOIN ACC.Voucher AS v2
            ON v2.VoucherID = src.VoucherID
        JOIN #voucherIds AS vi
            ON vi.value = src.VoucherID
    WHERE src.preVoucherDate > src.VoucherDate;

    IF @isDelete <> 1 AND EXISTS (SELECT 1 FROM #voucherPrevoucherDateIssue)
    BEGIN
        RAISERROR(N'Accounting.SystemVoucherPreVoucherDateIssue', 16, 12);
        RETURN 0;
    END;

    IF @isDelete <> 1
       AND EXISTS
    (
        SELECT 1
        FROM #ValidateVoucherHeaders AS v
        WHERE v.Date NOT
        BETWEEN @fromDate AND @toDate
    )
    BEGIN
        RAISERROR(N'InvalidDate', 16, 12);
        RETURN 0;
    END;
    
    
    if EXISTS(
SELECT 1
    FROM ACC.VoucherItem AS vi
        JOIN ACC.Voucher AS v
            ON v.VoucherID = vi.VoucherID
        JOIN #voucherIds AS vi2
            ON v.VoucherID = vi2.value
    WHERE vi.Debit<> ROUND(vi.Debit,@baseCurrenncyPercisionCount)
    or vi.Credit <> ROUND(vi.Credit,@baseCurrenncyPercisionCount))
    BEGIN
    	
         RAISERROR(N'DebitOrCreditRoundDigitsAreDifferentFromBaseCurrencyAllowedRoundDigits', 16, 12);
        RETURN 0;
    
    END

    DECLARE @r NVARCHAR(MAX);

    IF @isDelete <> 1
       AND EXISTS
    (
        SELECT 1
        FROM #ValidateVoucherHeaders AS v
            LEFT JOIN
            (
                SELECT vi.VoucherID,
                       COUNT(vi.VoucherID) itemCount
                FROM ACC.VoucherItem AS vi
                GROUP BY vi.VoucherID
            ) AS items
                ON items.VoucherID = v.VoucherID
        WHERE items.itemCount IS NULL
    )
    BEGIN

        SELECT @r = STUFF(
                    (
                        SELECT ',' + CAST(v.Number AS NVARCHAR(50))
                        FROM #ValidateVoucherHeaders AS v
                            LEFT JOIN
                            (
                                SELECT vi.VoucherID,
                                       COUNT(vi.VoucherID) itemCount
                                FROM ACC.VoucherItem AS vi
                                GROUP BY vi.VoucherID
                            ) AS items
                                ON items.VoucherID = v.VoucherID
                        WHERE items.itemCount IS NULL
                        FOR XML PATH('')
                    ),
                    1,
                    1,
                    ''
                         );

        SET @Message = N'InsertItem#' + @r;
        RAISERROR(@Message, 16, 12);
        RETURN 0;
    END;

    SELECT v.Number,
           vi.VoucherItemIndex
    INTO #debitCreditProblem
    FROM ACC.VoucherItem AS vi
        JOIN ACC.Voucher AS v
            ON v.VoucherID = vi.VoucherID
        JOIN #voucherIds AS vi2
            ON v.VoucherID = vi2.value
    WHERE v.VoucherStatusID <> 2
          AND vi.Debit = 0
          AND vi.Credit = 0;

    IF @isDelete <> 1 AND EXISTS (SELECT 1 FROM #debitCreditProblem)
    BEGIN

        SELECT @r
            = STUFF(
              (
                  SELECT N'#' + CAST(dcp.Number AS NVARCHAR(50)) + N' ' + CAST(dcp.VoucherItemIndex AS NVARCHAR(50))
                  FROM #debitCreditProblem AS dcp
                  FOR XML PATH('')
              ),
              1,
              1,
              ''
                   );

        SET @Message = N'BothDebitCredit#' + @r;
        RAISERROR(@Message, 16, 12);
        RETURN 0;
    END;

    SELECT v.Number,
           vi.VoucherItemIndex
    INTO #debitCreditCurrencyProblem
    FROM ACC.VoucherItem AS vi
        JOIN ACC.Voucher AS v
            ON v.VoucherID = vi.VoucherID
        JOIN #voucherIds AS vi2
            ON v.VoucherID = vi2.value
    WHERE v.VoucherStatusID <> 2
          AND v.AutoGenerated = 0
          AND vi.CurrencyDebit = 0
          AND vi.CurrencyCredit = 0;
    IF @isDelete <> 1 AND EXISTS (SELECT 1 FROM #debitCreditCurrencyProblem)
    BEGIN

        SELECT @r
            = STUFF(
              (
                  SELECT N'#' + CAST(dcp.Number AS NVARCHAR(50)) + N' ' + CAST(dcp.VoucherItemIndex AS NVARCHAR(50))
                  FROM #debitCreditCurrencyProblem AS dcp
                  FOR XML PATH('')
              ),
              1,
              1,
              ''
                   );

        SET @Message = N'Accounting.Messages.currencyDebitCreditZeroIssue#' + @r;
        RAISERROR(@Message, 16, 12);
        RETURN 0;
    END;

    SELECT t.Number
    INTO #unbalanceVouchers
    FROM
    (
        SELECT vi.VoucherID,
               v.Number,
               SUM(vi.Debit) - SUM(vi.Credit) AS Diff
        FROM ACC.VoucherItem AS vi
            JOIN #voucherIds AS vi2
                ON vi.VoucherID = vi2.value
            JOIN ACC.Voucher AS v
                ON v.VoucherID = vi.VoucherID
                   AND v.VoucherStatusID <> 2
        GROUP BY vi.VoucherID,
                 v.Number
    ) t
    WHERE t.Diff <> 0;

    IF @isDelete <> 1 AND EXISTS (SELECT 1 FROM #unbalanceVouchers)
    BEGIN
        SELECT @r = STUFF(
                    (
                        SELECT N',' + CAST(v.Number AS NVARCHAR(50))
                        FROM #unbalanceVouchers v
                        FOR XML PATH('')
                    ),
                    1,
                    1,
                    ''
                         );

        SET @Message = N'Accounting.VoucherNotBalance#' + @r;
        RAISERROR(@Message, 16, 12);
        RETURN 0;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM ACC.Voucher AS v
            JOIN CFG.Branch AS b
                ON b.BranchID = v.BranchID
        WHERE v.DocumentTypeID = 3
              AND v.FinancialPeriodID = @currentFinancialPeriodID
              AND EXISTS
        (
            SELECT [value]
            FROM #voucherIds
            WHERE value = v.VoucherID
        )
              AND EXISTS
        (
            SELECT v2.BranchID
            FROM ACC.Voucher AS v2
                JOIN CFG.Branch b2
                    ON b2.BranchID = v2.BranchID
                JOIN #voucherIds v3
                    ON v2.VoucherID = v3.value
            WHERE b.CompanyID = b2.CompanyID
        )
    )
    BEGIN

        RAISERROR('ACC_spIssueVoucher_1', 16, 12);
        RETURN 0;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM #ValidateVoucherHeaders AS v
            JOIN
            (
                SELECT b.CompanyID,
                       MAX(v.Date) [Date]
                FROM ACC.Voucher v
                    JOIN CFG.Branch AS b
                        ON b.BranchID = v.BranchID
                WHERE v.VoucherStatusID = 4
                      AND v.FinancialPeriodID = @currentFinancialPeriodID
                GROUP BY b.CompanyID
            ) a
                ON v.CompanyID = a.CompanyID
        WHERE v.[Date] <= a.Date
    )
    BEGIN
        RAISERROR('ACC_spIssueVoucher_2', 16, 12);
        RETURN 0;
    END;

    SELECT v.Number,
           vi.VoucherItemIndex
    INTO #accontLevelProblem
    FROM ACC.VoucherItem AS vi
        JOIN #voucherIds AS vi2
            ON vi.VoucherID = vi2.value
        RIGHT JOIN ACC.AccountLevelSL AS als
            ON als.SlID = vi.SlID
        JOIN ACC.AccountLevel AS al
            ON al.AccountLevelID = als.AccountLevelID
        JOIN ACC.Voucher AS v
            ON v.VoucherID = vi.VoucherID
        LEFT JOIN ACC.AccountLevelVoucherItem AS alvi
            ON alvi.VoucherItemID = vi.VoucherItemID
               AND als.AccountLevelID = alvi.AccountLevelID
    WHERE (
              al.AccountLevelTypeID = 1
              OR al.IsMandatory = 1
          )
          AND
          (
              (
                  al.AccountLevelTypeID = 1
                  AND alvi.DlID IS NULL
              )
              OR
              (
                  al.AccountLevelTypeID <> 1
                  AND alvi.Value IS NULL
              )
          )
          AND v.VoucherStatusID = 1
          AND
          (
              @voucherItemIds IS NULL
              OR vi.VoucherItemID IN
                 (
                     SELECT VoucherItemId FROM #voucherItemIds
                 )
          );

    IF @isDelete = 0 AND EXISTS (SELECT 1 FROM #accontLevelProblem)
    BEGIN
        SELECT @r
            = STUFF(
              (
                  SELECT N'#' + CAST(alp.Number AS NVARCHAR(50)) + N' ' + CAST(alp.VoucherItemIndex AS NVARCHAR(50))
                  FROM #accontLevelProblem AS alp
                  FOR XML PATH('')
              ),
              1,
              1,
              ''
                   );

        SET @Message = N'Accounting.AccountLevelsRequired#' + @r;
        RAISERROR(@Message, 16, 12);
        RETURN 0;
    END;

    SELECT v.Number,
           vi.VoucherItemIndex
    INTO #accountLevelDlTypeProblem
    FROM ACC.VoucherItem AS vi
        JOIN #voucherIds AS vi2
            ON vi.VoucherID = vi2.value
        JOIN ACC.Voucher AS v
            ON v.VoucherID = vi.VoucherID
        JOIN ACC.AccountLevelVoucherItem AS alvi
            ON alvi.VoucherItemID = vi.VoucherItemID
        JOIN ACC.DL AS d
            ON d.DLID = alvi.DlID
        LEFT JOIN ACC.AccountLevelSL AS als
            ON als.SlID = vi.SlID
               AND als.AccountLevelID = alvi.AccountLevelID
    WHERE alvi.DlID IS NOT NULL
          AND
          (
              als.AccountLevelSLID IS NULL
              OR als.DlTypeID IS NULL
              OR als.DlTypeID <> d.DlTypeID
          )
          AND
          (
              @voucherItemIds IS NULL
              OR vi.VoucherItemID IN
                 (
                     SELECT VoucherItemId FROM #voucherItemIds
                 )
          );

    IF @isDelete <> 1 AND EXISTS (SELECT 1 FROM #accountLevelDlTypeProblem)
    BEGIN
        SELECT @r
            = STUFF(
              (
                  SELECT N'#' + CAST(p.Number AS NVARCHAR(50)) + N' ' + CAST(p.VoucherItemIndex AS NVARCHAR(50))
                  FROM #accountLevelDlTypeProblem AS p
                  FOR XML PATH('')
              ),
              1,
              1,
              ''
                   );

        SET @Message = N'Accounting.AccountLevelDlTypeMismatch#' + @r;
        RAISERROR(@Message, 16, 12);
        RETURN 0;
    END;

	SELECT v.Number
    INTO #voucherAnalyzeProblem
    FROM ACC.Voucher AS v
	JOIN ACC.VoucherItem AS vi
		ON v.VoucherID = vi.VoucherID
	JOIN ACC.VoucherAnalyze AS va
		ON vi.VoucherItemID = va.DebitVoucherItemID 
		OR vi.VoucherItemID = va.CreditVoucherItemID
    JOIN #voucherIds AS vi2
		ON vi.VoucherID = vi2.value

	IF @isDelete = 1 AND EXISTS (SELECT 1 FROM #voucherAnalyzeProblem)
    BEGIN
        SELECT @r = STUFF(
              (
                  SELECT N',' + CAST(vap.Number AS NVARCHAR(50))  
                  FROM #voucherAnalyzeProblem AS vap
                  FOR XML PATH('')
              ), 1, 1, '');

        SET @Message = N'Accounting.DueToFlowInVoucherAnalyzeItIsNotPossibleToDeleteTheFollowingVouchers#' + @r;
        RAISERROR(@Message, 16, 12);
        RETURN 0;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM #voucherIds v
            JOIN ACC.Voucher v2
                ON v.value = v2.VoucherID
            JOIN NOC.AccrueDataCollection a
                ON v.value = a.VoucherID
        WHERE v2.CreationDate <> v2.LastEditionDate
              OR @isDelete = 1
    )
    BEGIN
        RAISERROR('DocumentsWithAccrualDataCollectionCannotBeDeletedOrEdited', 16, 12);
        RETURN 0;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM #voucherIds v
            JOIN ACC.Voucher v2
                ON v.value = v2.VoucherID
            JOIN NOC.CashDataCollection a
                ON v.value = a.VoucherID
        WHERE v2.CreationDate <> v2.LastEditionDate
              OR @isDelete = 1
    )
    BEGIN
        RAISERROR('DocumentsWithAccrualDataCollectionCannotBeDeletedOrEdited', 16, 12);
        RETURN 0;
    END;

    DECLARE @accontLevels NVARCHAR(MAX),
            @joinStr NVARCHAR(MAX),
            @query NVARCHAR(MAX),
            @tasirTempTable NVARCHAR(20),
            @voucherTempTable NVARCHAR(20),
            @apportionTempTable NVARCHAR(20),
            @resTable NVARCHAR(20);

    SET @tasirTempTable = CFG.getTempTableName(1);
    SET @voucherTempTable = CFG.getTempTableName(1);
    SET @apportionTempTable = CFG.getTempTableName(1);
    SET @resTable = CFG.getTempTableName(1);

    SELECT @accontLevels = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME(CAST(al.AccountLevelID AS VARCHAR(5)))
        FROM ACC.AccountLevel AS al
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                                );

    SELECT @joinStr
        = STUFF(
    (
        SELECT DISTINCT
               ' AND ISNULL(T1.' + QUOTENAME(CAST(al.AccountLevelID AS VARCHAR(5))) + ',0) = ISNULL(T2.'
               + QUOTENAME(CAST(al.AccountLevelID AS VARCHAR(5))) + ',0)'
        FROM ACC.AccountLevel AS al
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );

    IF @accontLevels IS NULL
        SET @accontLevels = N'[-1]';

    IF @joinStr IS NULL
        SET @joinStr = N' ';

    SET @query
        = N'
			SELECT v.VoucherID,
			v.[Date] ,
                  vi.SlID ,
                  vi.CurrencyID,
				  ' + @accontLevels + N'
			 INTO ' + @tasirTempTable
          + N' 
           FROM   ACC.Voucher AS v
                  JOIN ACC.VoucherItem AS vi ON vi.VoucherID = v.VoucherID
                  LEFT JOIN (   SELECT alvi.VoucherItemID ,
                                       alvi.DlID ,
                                       alvi.AccountLevelID
                                FROM   ACC.AccountLevelVoucherItem AS alvi
                                WHERE  alvi.DlID IS NOT NULL ) a
                  PIVOT (   MAX(DlID)
                            FOR AccountLevelID IN ( ' + @accontLevels
          + N' )) piv ON piv.VoucherItemID = vi.VoucherItemID
           WHERE  v.DocumentTypeID = 6 AND
				  vi.CurrencyID <> -1 
                  AND v.FinancialPeriodID = @financialPeriodID 
				  AND (@voucherItemIds IS NULL OR vi.VoucherItemID NOT IN (SELECT VoucherItemId FROM #voucherItemIds))
			';

    EXEC sys.sp_executesql @query,
                           N'@financialPeriodID	INT,
						@voucherItemIds		nvarchar(max)',
                           @financialPeriodID = @currentFinancialPeriodID,
                           @voucherItemIds = @voucherItemIds;

    SET @query
        = N'
			SELECT	v.Number,
				vi.VoucherItemIndex,
				v.VoucherID as V_VoucherID,
				v.Date ,
				vi.SlID ,
                vi.CurrencyID,
				  ' + @accontLevels + N'
			 INTO ' + @voucherTempTable
          + N'
                FROM   ACC.Voucher AS v
					   JOIN	#VoucherIds vv on vv.value = v.VoucherId
                       JOIN ACC.VoucherItem AS vi ON vi.VoucherID = v.VoucherID
                       LEFT JOIN (   SELECT alvi.VoucherItemID ,
                                       alvi.DlID ,
                                       alvi.AccountLevelID
                                FROM   ACC.AccountLevelVoucherItem AS alvi
                                WHERE  alvi.DlID IS NOT NULL ) AS a
                       PIVOT (   MAX(DlID)
                                 FOR AccountLevelID IN ( ' + @accontLevels
          + N' )) piv ON piv.VoucherItemID = vi.VoucherItemID
			WHERE @voucherItemIds IS NULL OR vi.VoucherItemID IN (SELECT VoucherItemId FROM #voucherItemIds) 
			 ';

    EXEC sys.sp_executesql @query,
                           N'@voucherItemIds		nvarchar(max)',
                           @voucherItemIds = @voucherItemIds;

    SET @query = N'
				SELECT	T2.Number,
						T2.VoucherItemIndex,
                        T1.SlID
						INTO ' + @resTable + N'
				FROM   ' + @tasirTempTable + N' AS T1
						JOIN ' + @voucherTempTable + N' AS T2 
                            ON T2.SlID = T1.SlID AND T2.CurrencyID = T1.CurrencyID
                            and t1.VoucherID <> t2.V_VoucherID
					   ' + @joinStr + N'
				WHERE  T1.[Date] >= T2.[Date]';
				
				

    EXEC (@query);
    
    

    SET @query
        = N'
			IF EXISTS (SELECT 1 FROM ' + @resTable
          + N')
			BEGIN
				declare @resItems nvarchar(200)

				SELECT @resItems = STUFF(( 
					select N''#'' + CAST(Number AS NVARCHAR(100)) + N'' '' +  ACC.SlFullCode(SlID)  --CAST(VoucherItemIndex AS NVARCHAR(100))
					from ' + @resTable
          + N'
					FOR XML PATH('''')
					)
					,1,1,'''')
				DECLARE @msg  NVARCHAR(255)= ''Accounting.TasirIssuedError#''+ @resItems
				RAISERROR(@msg,16,12)
				RETURN
			END';

    DECLARE @error NVARCHAR(MAX);
    BEGIN TRY
        EXEC (@query);
    END TRY
    BEGIN CATCH
        SET @error = ERROR_MESSAGE();
        RAISERROR(@error, 16, 12);
        RETURN 0;
    END CATCH;

    SET @query
        = N'
				SELECT ap.EndDate ,
				isNull(apc.VoucherID,-1) as ApportionVoucherID,
					   pi.SlID ,
								  ' + @accontLevels + N'
						INTO ' + @apportionTempTable
          + N'
				FROM   APT.ApportionCalculation AS ac
					   JOIN APT.ApportionPeriodCalculation AS apc 
							ON apc.ApportionPeriodCalculationID = ac.ApportionPeriodCalculationID
					   JOIN APT.ApportionPeriod AS ap 
							ON ap.ApportionPeriodID = apc.ApportionPeriodID
					   LEFT JOIN (   SELECT acal.ApportionCalculationID ,
											acal.DLID ,
											acal.AccountLevelID
									 FROM   APT.ApportionCalculationAccountLevel AS acal
									 WHERE  acal.DLID IS NOT NULL ) x
					   PIVOT (   MAX(DLID)
								 FOR AccountLevelID IN ( ' + @accontLevels
          + N' )) piv ON piv.ApportionCalculationID = ac.ApportionCalculationID
					   JOIN APT.PortionerItem AS pi ON pi.PortionerItemID = ac.PortionerItemID
					   WHERE ap.FinancialPeriodID = @financialPeriodID';

    EXEC sys.sp_executesql @query,
                           N'@financialPeriodID			INT',
                           @financialPeriodID = @currentFinancialPeriodID;

    SET @query = N'
					IF OBJECT_ID(''tempdb..' + @resTable + N''' ) IS NOT NULL
					BEGIN 
						DROP TABLE ' + @resTable + N'
					END ';

    EXEC (@query);

    SET @query
        = N'
					SELECT	T2.Number,
							T2.VoucherItemIndex
							INTO ' + @resTable + N'
					FROM   ' + @apportionTempTable + N' AS T1
							JOIN ' + @voucherTempTable + N' AS T2 ON T2.SlID = T1.SlID
						   ' + @joinStr
          + N'
					WHERE  T1.[EndDate] >= T2.[Date] and ApportionVoucherID <> V_VoucherID';

    EXEC (@query);

    SET @query
        = N'
				IF EXISTS (SELECT 1 FROM ' + @resTable
          + N')
				BEGIN 
					declare @resItems nvarchar(200)

					SELECT @resItems = STUFF(( 
						select N''#''+ CAST(Number AS NVARCHAR(100)) + N'' '' +   CAST(VoucherItemIndex AS NVARCHAR(100))
						from ' + @resTable
          + N'
						FOR XML PATH('''')
						)
						,1,1,'''')
					DECLARE @msg  NVARCHAR(255)= ''Accounting.ApportionIssuedError#''+ @resItems
					RAISERROR(@msg,16,12)
					RETURN
				END';

    BEGIN TRY
        EXEC (@query);
    END TRY
    BEGIN CATCH
        SET @error = ERROR_MESSAGE();
        RAISERROR(@error, 16, 12);
        RETURN 0;
    END CATCH;

    SET @query = N'	DROP TABLE ' + @resTable + N' 
				DROP TABLE ' + @apportionTempTable + N'	
				DROP TABLE ' + @tasirTempTable + N' 
				DROP TABLE ' + @voucherTempTable;

    EXEC (@query);

    DECLARE @vouchers ArrayInput;

    INSERT @vouchers
    (
        Val
    )
    SELECT vi.value
    FROM #voucherIds AS vi;

    EXEC CFG.CheckEntityHasFlowInEntityCustomeField @engName = N'Voucher',
                                                    @entityId = @vouchers;

END;

