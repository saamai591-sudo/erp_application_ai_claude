
CREATE      FUNCTION [VND].[PurchaseInvoiceHasFlow]
(
    @ID INT
)
RETURNS BIT
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @Result BIT,
            @Count INT;

    --PaymentRequest
    IF OBJECT_ID('req.PaymentRequest') IS NOT NULL
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1) 
						 FROM req.PaymentRequest pr
						 JOIN req.PaymentRequestItem pri 
                            			 ON pri.PaymentRequestID = pr.PaymentRequestID
						 WHERE pri.BaseDocumentType = 2 AND pri.BaseDocumentID = @ID
						 AND pr.[Status] <> 3 AND pr.Status <> 5
                     ),
                     0
                           );

    --PaymentSubject
    IF OBJECT_ID('FIN.PaymentSubject') IS NOT NULL
       AND @Count = 0
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1) 
						 FROM FIN.PaymentSubject ps 
						 join fin.PaymentReceipt pr on ps.PaymentReceiptID = pr.PaymentReceiptID
						 WHERE PurchaseInvoiceID = @ID
						 AND pr.Status <> 2
                     ),
                     0
                           );

    --PettyCashCostItem
    IF OBJECT_ID('FIN.PettyCashCostItem') IS NOT NULL
       AND @Count = 0
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1)
                         FROM FIN.PettyCashCostItem AS pcci
                         WHERE PurchaseInvoiceID = @ID
                     ),
                     0
                           );

    --DebitCreditNoteItem
    IF OBJECT_ID('CFG.DebitCreditNoteItem') IS NOT NULL
       AND @Count = 0
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1)
                         FROM CFG.DebitCreditNoteItem AS pcci
                         WHERE PurchaseInvoiceID = @ID
                     ),
                     0
                           );

    --ManualReceipt
    IF OBJECT_ID('CFG.ManualReceipt') IS NOT NULL
       AND @Count = 0
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1)
                         FROM CFG.ManualReceipt AS pcci
                         WHERE PurchaseInvoiceID = @ID
                     ),
                     0
                           );

    --ReceiveSubject
    IF OBJECT_ID('FIN.ReceiveSubject') IS NOT NULL
       AND @Count = 0
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1) FROM FIN.ReceiveSubject WHERE PurchaseInvoiceID = @ID
                     ),
                     0
                           );

    --CNT.ConfirmStatementDetail
    IF OBJECT_ID('CNT.ContractStatementDetail') IS NOT NULL
       AND @Count = 0
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1)
                         FROM CNT.ContractStatementDetail AS cs
                         WHERE basedocumenttype = 2 and basedocumentid = @ID
                     ),
                     0
                           );

    IF (@Count IS NULL OR @Count = 0)
        SET @Result = 0;
    ELSE
        SET @Result = 1;

    RETURN @Result;
END;

