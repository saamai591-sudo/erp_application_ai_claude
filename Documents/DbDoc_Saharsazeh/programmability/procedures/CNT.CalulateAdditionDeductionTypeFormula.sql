
CREATE   PROC [CNT].CalulateAdditionDeductionTypeFormula
(
    @ContractStatementID INT = NULL,
    @AdditionDeductionType INT,
    @AdditionDeductionTypeMethodId INT,
    @type INT,
    @BaseId INT,
    @Cost DECIMAL(30, 4) = NULL
)
--WITH ENCRYPTION 
AS
BEGIN

    CREATE TABLE #CalcTable
    (
        CalcID VARCHAR(50),
        AdditionDeductionTypeMethodID INT,
        AdditionDeductionType INT,
        [Value] FLOAT,
        ContractStatementID INT,
        PurchaseInvoiceId INT
    );

    INSERT INTO #CalcTable
    (
        CalcID,
        AdditionDeductionTypeMethodID,
        AdditionDeductionType,
        Value,
        ContractStatementID
    )
    SELECT 'P' + CAST(@AdditionDeductionTypeMethodId * 1000000 + 1 AS VARCHAR(50)),
           @AdditionDeductionTypeMethodId,
           @AdditionDeductionType,
           NULL,
           @ContractStatementID;


    DECLARE @contractStatementType INT,
            @contractId INT,
            @number INT,
			@Gross decimal(36,10);


	select @Gross = SUM(csi.Amount)
	from cnt.VwContractStatementItem csi
	WHERE csi.ContractStatementID = @ContractStatementID
	and BaseOfAdditionDeduction = 1


    SELECT @contractId = c.ContractID,
           @contractStatementType = cs2.ContractStatementTypeID,
           @number = cs2.Number
    FROM CNT.[Contract] AS c
        JOIN CNT.ContractStatement AS cs2
            ON cs2.ContractID = c.ContractID
    WHERE cs2.ContractStatementID = @ContractStatementID;

    SELECT ROW_NUMBER() OVER (ORDER BY cs.Number DESC) RN,
           cs.ContractStatementID
    INTO #lastItems
    FROM CNT.ContractStatement AS cs
    WHERE cs.ContractID = @contractId
          AND cs.ContractStatementTypeID = @contractStatementType
          AND cs.Number < @number;

    --------------------FOR CONTRACTSTATEMENT-------------------

    IF @ContractStatementID IS NOT NULL
    BEGIN
        INSERT #CalcTable
        (
            CalcID,
            AdditionDeductionTypeMethodID,
            AdditionDeductionType,
            Value,
            ContractStatementID
        )
        SELECT DISTINCT
               'P' + CAST(adtfp.AdditionDeductionTypeID * 1000000 + adtfp.Type AS VARCHAR(50)) + '',
               adtm.AdditionDeductionTypeMethodID,
               adtfp.AdditionDeductionTypeID,
               NULL,
               CASE
                   WHEN adtfp.AdditionDeductionTypeID < 0
                        AND adtfp.Type = 1 THEN
                       @ContractStatementID
                   ELSE
                       a.ContractStatementID
               END
        FROM CNT.AdditionDeductionTypeFormulaParameter AS adtfp
            JOIN CNT.AdditionDeductionTypeMethodFormula AS adtmf
                ON adtmf.AdditionDeductionTypeMethodFormulaID = adtfp.AdditionDeductionTypeMethodFormulaID
            LEFT JOIN CNT.AdditionDeductionTypeMethod AS adtm
                ON adtm.AdditionDeductionTypeID = adtfp.AdditionDeductionTypeID
            LEFT JOIN #lastItems a
                ON (
                       (
                           adtfp.Type = 1
                           AND a.RN = 1
                       )
                       OR adtfp.Type <> 1
                   )
        WHERE adtmf.AdditionDeductionTypeMethodID = @AdditionDeductionTypeMethodId;

    END;
    ------------------- FOR PURCHASEINVOICE-------------------

    IF @Cost IS NOT NULL
    BEGIN

        INSERT #CalcTable
        (
            CalcID,
            AdditionDeductionTypeMethodID,
            AdditionDeductionType,
            Value,
            ContractStatementID
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

    END;
    UPDATE ct
    SET ct.Value = CASE
                       WHEN ct.AdditionDeductionType = -1 THEN -- StatementNet
                           CASE WHEN @ContractStatementID IS NOT NULL THEN
                                        ISNULL(
                                                (CASE @type
                                                        WHEN 1 THEN @Gross
                                                        WHEN 2 THEN
                                                        (
                                                            SELECT SUM(csi.Amount)
                                                            FROM CNT.ContractStatementItem AS csi
                                                            WHERE csi.ContractStatementItemID = @BaseId
                                                        )
                                                        WHEN 3 THEN
                                                        (
                                                            SELECT SUM(csd.Amount)
                                                            FROM CNT.ContractStatementDetail AS csd
                                                            WHERE csd.ContractStatementID = @ContractStatementID
                                                        )
                                                        ELSE
                                                            0
                                                    END
                                                ),
                                                0
                                            )
                               ELSE
                                   ISNULL(@Cost, 0)
                           END
                       WHEN ct.AdditionDeductionType = -2 THEN -- StatementSum
                           CASE
                               WHEN @ContractStatementID IS NOT NULL THEN
                               (
                                   SELECT CASE
                                              WHEN c.StatementDeliverySection = 1 THEN
                                                  ISNULL(
                                                  (
                                                      SELECT SUM(cs3.Amount)
                                                      FROM CNT.ContractStatementItem AS cs3
                                                      WHERE @ContractStatementID = cs3.ContractStatementID
                                                  ),
                                                  0
                                                        )
                                              ELSE
                                                  ISNULL(
                                                  (
                                                      SELECT SUM(cs.Amount)
                                                      FROM CNT.ContractStatementItem AS cs
                                                          JOIN CNT.ContractStatement AS cs4
                                                              ON cs4.ContractStatementID = cs.ContractStatementID
                                                      WHERE cs4.ContractID = @contractId
                                                  ),
                                                  0
                                                        )
                                          END
                                   FROM CNT.[Contract] AS c
                                       JOIN CNT.ContractStatement AS cs5
                                           ON cs5.ContractID = c.ContractID
                                   WHERE cs5.ContractStatementID = ct.ContractStatementID
                               )
                               ELSE
                                   ISNULL(@Cost, 0)
                           END
                       WHEN ct.AdditionDeductionType = -3 THEN --ContractFirstPrice
                           ISNULL(
                           (
                               SELECT SUM(cs2.Price)
                               FROM CNT.Contract AS c
                                   JOIN CNT.ContractSubject AS cs2
                                       ON cs2.ContractID = c.ContractID
                               WHERE c.ContractID = @contractId
                           ),
                           0
                                 )
                       WHEN ct.AdditionDeductionType = -4 THEN --ContractComplementTotalPrice
                           ISNULL(
                           (
                               SELECT SUM(v.Price - v.FirstPrice)
                               FROM CNT.VWContractSubject v
                               WHERE v.Issupplementary = 1
                                     AND v.ContractID = @contractId
                           ),
                           0
                                 )
                       WHEN ct.AdditionDeductionType = -5 THEN -- ContractFinalPrice
                           ISNULL(
                           (
                               SELECT SUM(vcs.Price)
                               FROM CNT.VWContractSubject AS vcs
                               WHERE vcs.ContractID = @contractId
                           ),
                           0
                                 )
                       WHEN ct.AdditionDeductionType = -6 THEN -- Prepayment
                           ISNULL(
                           (
                               SELECT SUM(a.Amount)
                               FROM
                               (
                                   SELECT ps.ContractID,
                                          ps.Amount
                                   FROM FIN.PaymentSubject AS ps
								   join fin.PaymentType pt on pt.PaymentTypeID = ps.PaymentTypeID
								   where pt.Type = 10
                                   UNION ALL
                                   SELECT dcni.ContractID,
                                          dcni.Amount
                                   FROM CFG.DebitCreditNoteItem AS dcni
								   join fin.PaymentType pt on pt.PaymentTypeID = dcni.PaymentTypeID
                                   WHERE dcni.Type = 0 and pt.Type = 10
                               ) a
                               WHERE a.ContractID = @contractId
                           ),
                           0
                                 )
                       WHEN ct.AdditionDeductionType = -7 THEN  --PreReceipt 
                           0
                   END
    FROM #CalcTable AS ct
    WHERE (
              ISNULL(ct.AdditionDeductionTypeMethodID, 0) <> @AdditionDeductionTypeMethodId
              OR
              (
                  @ContractStatementID IS NOT NULL
                  AND ct.ContractStatementID <> @ContractStatementID
              )
              OR (@Cost IS NOT NULL)
          )
          AND ct.AdditionDeductionType < 0;
		  

		  
    UPDATE ct
    SET ct.Value = ISNULL(
                   (
                       SELECT SUM(   CASE
                                         WHEN csi.Deduction <> 0 THEN
                                             csi.Deduction
                                         ELSE
                                             csi.Addition
                                     END
                                 )
                       FROM CNT.ConfirmStatementItem AS csi
                           JOIN CNT.ConfirmStatement AS cs
                               ON cs.ConfirmStatementID = csi.ConfirmStatementID
                       WHERE cs.ContractStatementID = ct.ContractStatementID
                             AND csi.AdditionDeductionTypeMethodID = ct.AdditionDeductionTypeMethodID
                   ),
                   0
                         )
    FROM #CalcTable AS ct
    WHERE (
              ISNULL(ct.AdditionDeductionTypeMethodID, 0) <> @AdditionDeductionTypeMethodId
              OR
              (
                  @ContractStatementID IS NOT NULL
                  AND ct.ContractStatementID <> @ContractStatementID
              )
              OR (@Cost IS NOT NULL)
          )
          AND ct.AdditionDeductionType > 0;


		  	
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
								 WHERE  (ISNULL(ct.AdditionDeductionTypeMethodID, 0) <> @AdditionDeductionTypeMethodId
							     OR( @ContractStatementID is not null and ct.ContractStatementID <>  @ContractStatementID ))
						) x
						PIVOT 
						(
						SUM(Value)
						FOR CalcID IN  (' + @cols
              + N')
						) s on s.Id  = t.id
			WHERE  ISNULL(t.AdditionDeductionTypeMethodID, 0) = @AdditionDeductionTypeMethodId
			and ( @ContractStatementID IS NULL OR t.ContractStatementID = @ContractStatementID )
			';

        IF @Condition IS NOT NULL
            SET @query = @query + N' AND ' + @Condition;
			print @query
        EXEC sys.sp_executesql @query,
                               N'@ContractStatementID INT,@AdditionDeductionTypeMethodId INT',
                               @ContractStatementID = @ContractStatementID,
                               @AdditionDeductionTypeMethodId = @AdditionDeductionTypeMethodId;

        FETCH NEXT FROM R
        INTO @Exp,
             @Condition,
             @formulaId;
    END;

    CLOSE R;
    DEALLOCATE R;

    SELECT CAST(ISNULL(ROUND(ct.Value, 0) , 0) AS DECIMAL(30, 4))
    FROM #CalcTable AS ct
    WHERE ISNULL(ct.AdditionDeductionTypeMethodID, 0) = @AdditionDeductionTypeMethodId
          AND
          (
              @ContractStatementID IS NULL
              OR ct.ContractStatementID = @ContractStatementID
          );

END;

