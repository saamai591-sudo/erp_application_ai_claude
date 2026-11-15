-------------------------------------
CREATE   FUNCTION [ACC].GetPreVoucherRelatedEntityId
(
    @documentType VARCHAR(100),
    @prevoucherid INT
)
RETURNS INT
BEGIN
    DECLARE @Id INT;

    IF @documentType = 'Invoice'
    BEGIN
        SELECT @Id = InvoiceID
        FROM SLE.Invoice
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'ReturnedSaleInvoice'
    BEGIN
        SELECT @Id = ReturnedSaleInvoiceID
        FROM SLE.ReturnedSaleInvoice
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'PurchaseInvoice'
    BEGIN
        SELECT @Id = PurchaseInvoiceID
        FROM VND.PurchaseInvoice
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'ReturnInvoice'
    BEGIN
        SELECT @Id = ReturnInvoiceID
        FROM VND.ReturnInvoice
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'StockReceipt'
    BEGIN
        SELECT @Id = StockReceiptID
        FROM STC.StockReceipt
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'ReturnStockReceipt'
    BEGIN
        SELECT @Id = ReturnStockReceiptID
        FROM STC.ReturnStockReceipt
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'Outgoing'
    BEGIN
        SELECT @Id = OutgoingID
        FROM STC.Outgoing
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'ReturnedOutgoing'
    BEGIN
        SELECT @Id = ReturnedOutgoingID
        FROM STC.ReturnedOutgoing
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'RevisionCost'
    BEGIN
        SELECT @Id = RevisionCostID
        FROM STC.RevisionCost
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'ReceiveReceipt'
    BEGIN
        SELECT @Id = ReceiveReceiptID
        FROM FIN.ReceiveReceipt
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType IN( 'PaymentReceipt' ,'PaymentWithOrder')
    BEGIN
        SELECT @Id = PaymentReceiptID
        FROM FIN.PaymentReceipt
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'ReceiptCheqeFlow'
    BEGIN
        SELECT @Id = ReceiptCheqeFlowID
        FROM FIN.ReceiptCheqeFlow
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'PaymentCheqeFlow'
    BEGIN
        SELECT @Id = PaymentCheqeFlowID
        FROM FIN.PaymentCheqeFlow
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'ReceiveCommitmentRecall'
    BEGIN
        SELECT @Id = ReceiveCommitmentRecallID
        FROM FIN.ReceiveCommitmentRecall
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'PaymentCommitmentRecall'
    BEGIN
        SELECT @Id = PaymentCommitmentRecallID
        FROM FIN.PaymentCommitmentRecall
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'ReceiveCommitment'
    BEGIN
        SELECT @Id = ReceiveCommitmentID
        FROM FIN.ReceiveCommitment
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'PaymentCommitment'
    BEGIN
        SELECT @Id = PaymentCommitmentID
        FROM FIN.PaymentCommitment
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'PettyCashCost'
    BEGIN
        SELECT @Id = PettyCashCostID
        FROM FIN.PettyCashCost
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'DebitCreditNote'
    BEGIN
        SELECT @Id = DebitCreditNoteID
        FROM CFG.DebitCreditNote
        WHERE PreVoucherID = @prevoucherid;
    END;

	IF @documentType = 'AssetReceipt'
	BEGIN
		SELECT @Id = AssetReceiptID
		FROM AST.AssetReceipt
		WHERE PreVoucherID = @prevoucherid;
	END;

    IF @documentType = 'Destruction'
    BEGIN
        SELECT @Id = DestructionID
        FROM AST.Destruction
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'Insurance'
    BEGIN
        SELECT @Id = InsuranceID
        FROM AST.Insurance
        WHERE PrevoucherID = @prevoucherid;
    END;


    IF @documentType = 'Sale'
    BEGIN
        SELECT @Id = SaleID
        FROM AST.Sale
        WHERE PrevoucherID = @prevoucherid;
    END;

    IF @documentType = 'Salvage'
    BEGIN
        SELECT @Id = SalvageID
        FROM AST.Salvage
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'Revaluation'
    BEGIN
        SELECT @Id = RevaluationID
        FROM AST.Revaluation
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'Adjustment'
    BEGIN
        SELECT @Id = AdjustmentID
        FROM AST.Adjustment
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'Delivery'
    BEGIN
        SELECT @Id = DeliveryID
        FROM POS.Delivery
        WHERE PreVoucherID = @prevoucherid
    END;

    IF @documentType = 'CostOfOrder'
    BEGIN
        SELECT @Id = CostOfOrderID
        FROM FOS.CostOfOrder
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'OrderPricing'
    BEGIN
        SELECT @Id = OrderPricingID
        FROM FOS.OrderPricing
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'LetterCredit'
    BEGIN
        SELECT @Id = LetterCreditID
        FROM FOS.LetterCredit
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'Repair'
    BEGIN
        SELECT @Id = RepairID
        FROM AST.Repair
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'Registration'
    BEGIN
        SELECT @Id = RegistrationID
        FROM FOS.Registration
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'GuarantyOperation'
    BEGIN
        SELECT @Id = GuarantyOperationID
        FROM FIN.GuarantyOperation
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'Clearance'
    BEGIN
        SELECT @Id = ClearanceID
        FROM FOS.Clearance
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'ChangeCategory'
    BEGIN
        SELECT @Id = ChangeCategoryID
        FROM AST.ChangeCategory
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'Transfer'
    BEGIN
        SELECT @Id = TransferID
        FROM AST.[Transfer]
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'ShippingInsurance'
    BEGIN
        SELECT @Id = ShippingInsuranceID
        FROM FOS.ShippingInsurance
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'BillOfLading'
    BEGIN
        SELECT @Id = BillOfLadingID
        FROM FOS.BillOfLading
        WHERE PreVoucherID = @prevoucherid;
    END;

    IF @documentType = 'ConfirmStatement'
    BEGIN
        SELECT @Id = cs.ConfirmStatementID
        FROM CNT.ConfirmStatement
AS          cs
        WHERE PreVoucherID = @prevoucherid;
    END;

        RETURN @Id;
END;
