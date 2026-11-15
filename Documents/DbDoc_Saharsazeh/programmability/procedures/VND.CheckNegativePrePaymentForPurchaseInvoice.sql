
--------------------------------------------------------------------------------------------------
CREATE   PROCEDURE VND.CheckNegativePrePaymentForPurchaseInvoice
(
    @Id INT
)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @HasConfirmStatement bit 
    SELECT @HasConfirmStatement = pt.HasConfirmStatement FROM VND.PurchaseInvoice p
        JOIN vnd.PurchaseType pt 
            ON p.[Type] = pt.PurchaseTypeID
    WHERE PurchaseInvoiceID = @Id

    SELECT * FROM (
    SELECT ps.RowIndex
    FROM   VND.PurchaseInvoicePrePayment AS pipp
            JOIN FIN.PaymentSubject AS ps ON ps.PaymentSubjectID = pipp.PaymentSubjectID
            JOIN FIN.PaymentSubject_PriceRemains AS pspr ON pspr.PaymentSubjectID = pipp.PaymentSubjectID
    WHERE  pspr.NonPrice < 0
            AND pipp.PurchaseInvoiceID = @Id
    UNION
    SELECT dcni.RowIndex
    FROM   VND.PurchaseInvoicePrePayment AS pipp
            JOIN CFG.DebitCreditNoteItem AS dcni ON dcni.DebitCreditNoteItemID = pipp.DebitCreditNoteItemID
            JOIN CFG.Debit_DebitCreditNoteItem_Remain AS ddcnir ON ddcnir.DebitCreditNoteItemID = dcni.DebitCreditNoteItemID
    WHERE  ddcnir.remain < 0
            AND pipp.PurchaseInvoiceID = @Id
    UNION
    SELECT pcci.RowIndex
    FROM   VND.PurchaseInvoicePrePayment AS pipp
            JOIN FIN.PettyCashCostItem AS pcci ON pcci.PettyCashCostItemID = pipp.PettyCashCostItemID
            JOIN FIN.PettyCashCostItem_Remain AS pccir ON pccir.PettyCashCostItemID = pcci.PettyCashCostItemID
    WHERE  pccir.remain < 0
            AND pipp.PurchaseInvoiceID = @Id) src
    WHERE @HasConfirmStatement = 0
END;
