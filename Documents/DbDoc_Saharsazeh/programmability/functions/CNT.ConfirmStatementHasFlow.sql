
CREATE         FUNCTION [CNT].[ConfirmStatementHasFlow]
    (
        @ConfirmStatementID INT
    )
RETURNS BIT
--WITH ENCRYPTION
AS
    BEGIN

        DECLARE @Count INT;

        SET @Count = ISNULL(
                     (   SELECT COUNT(*)
                         FROM   fin.PaymentSubject a
						 join fin.PaymentReceipt b
							on a.PaymentReceiptID = b.PaymentReceiptID
                         WHERE  ConfirmStatementID = @ConfirmStatementID
						 and b.Status <> 2) ,
                     0);

        IF @Count > 0
            BEGIN
                RETURN 1;
            END;

        SET @Count = ISNULL(
                     (   SELECT COUNT(*)
                         FROM   fin.ReceiveSubject
                         WHERE  ConfirmStatementID = @ConfirmStatementID ) ,
                     0);

        IF @Count > 0
            BEGIN
                RETURN 1;
            END;


        SET @Count = ISNULL(
                     (   SELECT COUNT(*)
                         FROM   cfg.DebitCreditNoteItem
                         WHERE  ConfirmStatementID = @ConfirmStatementID ) ,
                     0);

        IF @Count > 0
            BEGIN
                RETURN 1;
            END;

        SET @Count = ISNULL(
        (
            SELECT COUNT(*)
            FROM req.PaymentRequestItem a
            JOIN req.PaymentRequest b
                ON a.PaymentRequestID = b.PaymentRequestID
            WHERE
                (
                    (a.BaseDocumentType = 4
                     AND a.BaseDocumentID = @ConfirmStatementID)
                 OR
                    (a.BaseDocumentType = 6
                     AND a.BaseDocumentID IN
                     (
                         SELECT ConfirmStatementItemID
                         FROM CNT.ConfirmStatementItem
                         WHERE ConfirmStatementID = @ConfirmStatementID
                     ))
                )
                AND b.Status NOT IN (3, 5)
        ),
        0);
        
        IF @Count > 0
        BEGIN
            RETURN 1;
        END;

        SET @Count = ISNULL(
                     (   SELECT COUNT(*)
                         FROM   fos.CreditAllocationItem
                         WHERE  ConfirmStatementID = @ConfirmStatementID ) ,
                     0);

        IF @Count > 0
            BEGIN
                RETURN 1;
            END;

        RETURN 0;
    END;

