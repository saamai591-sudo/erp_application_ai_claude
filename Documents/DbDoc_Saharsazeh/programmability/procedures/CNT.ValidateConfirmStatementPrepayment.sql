CREATE   PROCEDURE [CNT].[ValidateConfirmStatementPrepayment]
(@confirmStatementID INT)
AS
BEGIN

    DECLARE @rowsWithError TABLE
    (
        rowIndex INT NOT NULL
    );
    DECLARE @rowIndexs NVARCHAR(200),
            @messages NVARCHAR(MAX) = N'';

    INSERT @rowsWithError
    (
        rowIndex
    )
    SELECT i.RowIndex
    FROM CNT.ConfirmStatementItem i
        JOIN CNT.AdditionDeductionType d
            ON i.AdditionDeductionTypeID = d.AdditionDeductionTypeID
        LEFT JOIN CNT.ConfirmStatementPrePayment AS p
            ON p.ConfirmStatementItemID = i.ConfirmStatementItemID
    WHERE d.Criterion = 2
          AND i.ConfirmStatementID = @confirmStatementID
          AND p.ConfirmStatementItemID IS NULL;

    IF EXISTS (SELECT 1 FROM @rowsWithError)
    BEGIN

        SET @rowIndexs = STUFF(
                         (
                             SELECT DISTINCT
                                    ' , ' + CAST(tt.rowIndex AS NVARCHAR(100))
                             FROM @rowsWithError tt
                             FOR XML PATH('')
                         ),
                         1,
                         3,
                         ''
                              );
        -- rows needed prepayment
        SET @messages = N'Contract.RowsNeededPrepayment^' + @rowIndexs;
        RAISERROR(@messages, 16, 12);
        RETURN;

    END;


    INSERT @rowsWithError
    (
        rowIndex
    )
    SELECT i.RowIndex
    FROM CNT.ConfirmStatementItem i
        JOIN
        (
            SELECT ConfirmStatementItemID,
                   SUM(Price) AS Price
            FROM CNT.ConfirmStatementPrePayment
            GROUP BY ConfirmStatementItemID
        ) AS r
            ON r.ConfirmStatementItemID = i.ConfirmStatementItemID
        JOIN CNT.AdditionDeductionType d
            ON i.AdditionDeductionTypeID = d.AdditionDeductionTypeID
    WHERE d.Criterion = 2
          AND i.ConfirmStatementID = @confirmStatementID
          AND
          (
              i.Addition IS NULL
              OR r.Price <> i.Addition
          )
          AND
          (
              i.Deduction IS NULL
              OR r.Price <> i.Deduction
          );

    IF EXISTS (SELECT 1 FROM @rowsWithError)
    BEGIN
        SET @rowIndexs = STUFF(
                         (
                             SELECT DISTINCT
                                    ' , ' + CAST(tt.rowIndex AS NVARCHAR(100))
                             FROM @rowsWithError tt
                             FOR XML PATH('')
                         ),
                         1,
                         3,
                         ''
                              );
        SET @messages = N'Contract.RowsInvalidPrepayment^' + @rowIndexs;
        -- invalid prepayment
        RAISERROR(@messages, 16, 12);
        RETURN;

    END;

    INSERT @rowsWithError
    (
        rowIndex
    )
    SELECT i.RowIndex
    FROM CNT.ConfirmStatementPrePayment r
        JOIN CNT.ConfirmStatementItem i
            ON r.ConfirmStatementItemID = i.ConfirmStatementItemID
        JOIN FIN.PaymentSubject_PriceRemains p
            ON r.PaymentSubjectID = p.PaymentSubjectID
    WHERE p.NonPrice < 0
          AND i.ConfirmStatementID = @confirmStatementID;

    IF EXISTS (SELECT 1 FROM @rowsWithError)
    BEGIN
        SET @rowIndexs = STUFF(
                         (
                             SELECT DISTINCT
                                    ' , ' + CAST(tt.rowIndex AS NVARCHAR(100))
                             FROM @rowsWithError tt
                             FOR XML PATH('')
                         ),
                         1,
                         3,
                         ''
                              );
        SET @messages = N'Contract.PrepaymentInvalidNon^' + @rowIndexs;
        -- prepayment non price invalid
        RAISERROR(@messages, 16, 12);
        RETURN;
    END;

END;
