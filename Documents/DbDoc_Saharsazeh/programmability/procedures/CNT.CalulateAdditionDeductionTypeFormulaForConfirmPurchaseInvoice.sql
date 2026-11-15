
CREATE   PROC [CNT].[CalulateAdditionDeductionTypeFormulaForConfirmPurchaseInvoice]
(
    @PurchaseInvoiceID INT ,
    @AdditionDeductionType INT,
    @AdditionDeductionTypeMethodId INT
)
--WITH ENCRYPTION 
AS
BEGIN
	DECLARE	@PrecisionCount INT = 2

	SELECT 
		@PrecisionCount = PrecisionCount 
	FROM VND.PurchaseInvoice PI
		JOIN CFG.Currency c ON pi.CurrencyID = c.CurrencyID
	WHERE PurchaseInvoiceID = @PurchaseInvoiceID

    CREATE TABLE #CalcTable
    (
        CalcID VARCHAR(50),
        AdditionDeductionTypeMethodID INT,
        AdditionDeductionType INT,
        [Value] FLOAT,
        PurchaseInvoiceID INT
    );

    INSERT INTO #CalcTable
    (
        CalcID,
        AdditionDeductionTypeMethodID,
        AdditionDeductionType,
        Value,
        PurchaseInvoiceID
    )
    SELECT 'P' + CAST(@AdditionDeductionTypeMethodId * 1000000 + 1 AS VARCHAR(50)),
           @AdditionDeductionTypeMethodId,
           @AdditionDeductionType,
           NULL,
           @PurchaseInvoiceID;

    INSERT #CalcTable
    (
        CalcID,
        AdditionDeductionTypeMethodID,
        AdditionDeductionType,
        Value,
        PurchaseInvoiceID
    )
    SELECT DISTINCT
            'P' + CAST(adtfp.AdditionDeductionTypeID * 1000000 + adtfp.Type AS VARCHAR(50)) + '',
            adtm.AdditionDeductionTypeMethodID,
            adtfp.AdditionDeductionTypeID,
            NULL,
            NULL
    FROM CNT.AdditionDeductionTypeFormulaParameter AS adtfp
        JOIN CNT.AdditionDeductionTypeMethodFormula AS adtmf
            ON adtmf.AdditionDeductionTypeMethodFormulaID = adtfp.AdditionDeductionTypeMethodFormulaID
        LEFT JOIN CNT.AdditionDeductionTypeMethod AS adtm
            ON adtm.AdditionDeductionTypeID = adtfp.AdditionDeductionTypeID
    WHERE adtmf.AdditionDeductionTypeMethodID = @AdditionDeductionTypeMethodId;



    UPDATE ct
    SET ct.Value = CASE
                       WHEN ct.AdditionDeductionType = -1 THEN -- Statement/Purchase Net
                          (
							SELECT TotalPrice - TotalDiscount 
							FROM VND.PurchaseInvoice
							WHERE PurchaseInvoiceID = @PurchaseInvoiceID
						  )
                       WHEN ct.AdditionDeductionType = -2 THEN -- StatementSum
                          0
                       WHEN ct.AdditionDeductionType = -3 THEN --ContractFirstPrice
                         0
                       WHEN ct.AdditionDeductionType = -4 THEN --ContractComplementTotalPrice
                          0
                       WHEN ct.AdditionDeductionType = -5 THEN -- ContractFinalPrice
                          0
                       WHEN ct.AdditionDeductionType = -6 THEN -- Prepayment
                           ISNULL(
                           (
                               SELECT SUM(a.Amount)
                               FROM
                               (
                                   SELECT ps.PurchaseInvoiceID,
                                          ps.Amount
                                   FROM FIN.PaymentSubject AS ps
                                   UNION ALL
                                   SELECT dcni.PurchaseInvoiceID,
                                          dcni.Amount
                                   FROM CFG.DebitCreditNoteItem AS dcni
                                   WHERE dcni.Type = 0
                               ) a
                               WHERE a.PurchaseInvoiceID = @PurchaseInvoiceID
                           ),
                           0
                                 )
                       WHEN ct.AdditionDeductionType = -7 THEN  --PreReceipt 
                           0
                   END
    FROM #CalcTable AS ct
    WHERE ISNULL(ct.AdditionDeductionTypeMethodID, 0) <> @AdditionDeductionTypeMethodId
			AND ct.AdditionDeductionType < 0;
	
    DECLARE @Exp NVARCHAR(MAX),
            @Condition NVARCHAR(MAX),
            @formulaId INT,
            @cols NVARCHAR(MAX);

    ALTER TABLE #CalcTable ADD Id INT NOT NULL DEFAULT 1;

    DECLARE R CURSOR FOR
    SELECT adtmf.SQLExpression,
           adtmf.SQLCondition,
           adtmf.AdditionDeductionTypeMethodFormulaID
    FROM CNT.AdditionDeductionTypeMethodFormula AS adtmf
    WHERE adtmf.AdditionDeductionTypeMethodID = @AdditionDeductionTypeMethodId;

    OPEN R;
    FETCH NEXT FROM R
    INTO @Exp,
         @Condition,
         @formulaId;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SELECT @cols = STUFF(
        (
            SELECT DISTINCT
                   ',[P' + CAST(adtfp.AdditionDeductionTypeID * 1000000 + adtfp.Type AS VARCHAR(50)) + ']'
            FROM CNT.AdditionDeductionTypeFormulaParameter AS adtfp
                JOIN CNT.AdditionDeductionTypeMethodFormula AS adtmf
                    ON adtmf.AdditionDeductionTypeMethodFormulaID = adtfp.AdditionDeductionTypeMethodFormulaID
            WHERE adtmf.AdditionDeductionTypeMethodID = @AdditionDeductionTypeMethodId
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'),
        1   ,
        1   ,
        ''
                            );

        DECLARE @query NVARCHAR(MAX)
            = N' update t 
				set Value = ' + @Exp
              + N' from #calcTable t
			 left join  (SELECT Id, ct.CalcID,ct.[Value] 
								 FROM #CalcTable AS ct
								 WHERE ISNULL(ct.AdditionDeductionTypeMethodID, 0) <> @AdditionDeductionTypeMethodId
						) x
						PIVOT 
						(
							SUM(Value)
							FOR CalcID IN  (' + @cols + N')
						) s on s.Id  = t.id
			WHERE  ISNULL(t.AdditionDeductionTypeMethodID, 0) = @AdditionDeductionTypeMethodId
			';

        IF @Condition IS NOT NULL
            SET @query = @query + N' AND ' + @Condition;

        EXEC sys.sp_executesql @query,
                               N'@PurchaseInvoiceID INT,@AdditionDeductionTypeMethodId INT',
                               @PurchaseInvoiceID = @PurchaseInvoiceID,
                               @AdditionDeductionTypeMethodId = @AdditionDeductionTypeMethodId;

        FETCH NEXT FROM R
        INTO @Exp,
             @Condition,
             @formulaId;
    END;

    CLOSE R;
    DEALLOCATE R;

    SELECT CAST(ISNULL(ROUND(ct.Value, @PrecisionCount) , 0) AS DECIMAL(30, 4))
    FROM #CalcTable AS ct
    WHERE ISNULL(ct.AdditionDeductionTypeMethodID, 0) = @AdditionDeductionTypeMethodId
END;

--next--------------------------------------------------------------------------------------------------------------------------------------------

