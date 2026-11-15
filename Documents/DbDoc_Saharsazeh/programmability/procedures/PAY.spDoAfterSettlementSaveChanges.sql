CREATE PROC PAY.spDoAfterSettlementSaveChanges @CalculationPersonelID INT
AS
BEGIN

    DECLARE @SettlementParameterID INT;

    SELECT @SettlementParameterID = p.ParameterID
    FROM PAY.Parameter AS p
    WHERE p.SystemName = 'SettlementParam';


    BEGIN
        DELETE FROM PAY.CalculationResult
        WHERE CalculationPersonelID = @CalculationPersonelID
              AND ParameterID = @SettlementParameterID;


        DECLARE @Value DECIMAL(30, 4);
        SELECT @Value = SUM(a.Amount)
        FROM
        (
            SELECT SUM(ISNULL(sc.Value, 0) - ISNULL(sc.Paid, 0)) Amount
            FROM PAY.SettlementCalculation AS sc
            WHERE sc.CalculationPersonelID = @CalculationPersonelID
            UNION ALL
            SELECT SUM(-1 * si.Value)
            FROM PAY.CalculationResult AS si
            WHERE si.LoanID IS NOT NULL
                  AND si.CalculationPersonelID = @CalculationPersonelID
                  AND si.ParameterValueTypeID = 7
            UNION ALL
            SELECT SUM(   CASE c.EngName
                              WHEN 'Benefit' THEN
                                  cr.Value
                              WHEN 'Fraction' THEN
                                  -1 * cr.Value
                              ELSE
                                  0
                          END
                      )
            FROM PAY.CalculationResult AS cr
                JOIN PAY.Parameter AS p
                    ON p.ParameterID = cr.ParameterID
                JOIN PAY.Category AS c
                    ON c.CategoryID = p.CategoryID
            WHERE cr.LoanID IS NULL
                  AND cr.CalculationPersonelID = @CalculationPersonelID
                  AND cr.ParameterValueTypeID = 7
        ) a;

        INSERT INTO PAY.CalculationResult
        (
            -- CalculationResultID -- this column value is auto-generated
            ParameterID,
            ParameterValueTypeID,
            [Value],
            LoanID,
            Version,
            Creator,
            CreationDate,
            LastEditor,
            LastEditionDate,
            CalculationPersonelID
        )
        VALUES
        (   @SettlementParameterID, /*{ ParameterValueTypeID }*/
            7,                      /*{ Value }*/
            @Value,                 /*{ Value }*/
            NULL,                   /*{ LoanID }*/
            0, CFG.GetuserID(), GETDATE(), CFG.GetuserID(), GETDATE(), @CalculationPersonelID);
    END;
END;
