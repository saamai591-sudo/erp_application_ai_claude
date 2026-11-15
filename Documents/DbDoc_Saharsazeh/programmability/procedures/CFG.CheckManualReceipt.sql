/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.2.349
 * Time: 3/5/2018 12:11:23 PM
 ************************************************************/

CREATE PROCEDURE [CFG].[CheckManualReceipt](@Id INT)
AS
	DECLARE @InstallmentPaymentItemID     INT,
	        @PurchaseInvoiceID            INT,
	        @InvoiceID                    INT,
	        @ReturnedSaleInvoiceID        INT,
	        @ReturnInvoiceID              INT,
	        @CalculationResultID          DECIMAL(18, 0)
	
	SELECT @InstallmentPaymentItemID = mr.InstallmentPaymentItemID,
	       @PurchaseInvoiceID         = mr.PurchaseInvoiceID,
	       @InvoiceID                 = mr.InvoiceID,
	       @ReturnedSaleInvoiceID     = mr.ReturnedSaleInvoiceID,
	       @ReturnInvoiceID           = mr.ReturnInvoiceID,
	       @CalculationResultID       = mr.CalculationResultID
	FROM   cfg.ManualReceipt AS mr
	WHERE  mr.ManualReceiptID = @Id
	
	IF @InstallmentPaymentItemID IS NOT NULL
	    IF EXISTS (
	           SELECT 1
	           FROM   [CFG].[vwInstallmentPaymentRemain]
	           WHERE  InstallmentPaymentItemID = @InstallmentPaymentItemID
	                  AND remain < 0
	       )
	    BEGIN
	        RAISERROR('مبلغ وارد شده از مانده  بیشتر می باشد ', 16, 12)
	        RETURN
	    END
	
	IF @PurchaseInvoiceID IS NOT NULL
	    IF EXISTS (
	           SELECT 1
	           FROM   vnd.PurchaseInvoice_NonPaymented
	           WHERE  PurchaseInvoiceID = @PurchaseInvoiceID
	                  AND NonPaymented < 0
	       )
	    BEGIN
	        RAISERROR('مبلغ وارد شده از مانده  بیشتر می باشد ', 16, 12)
	        RETURN
	    END
	
	IF @InvoiceID IS NOT NULL
	    IF EXISTS (
	           SELECT 1
	           FROM   sle.Invoice_NonReceived AS inr
	           WHERE  inr.InvoiceID = @InvoiceID
	                  AND inr.NonReceived < 0
	       )
	    BEGIN
	        RAISERROR('مبلغ وارد شده از مانده  بیشتر می باشد ', 16, 12)
	        RETURN
	    END
	
	IF @ReturnedSaleInvoiceID IS NOT NULL
	    IF EXISTS (
	           SELECT 1
	           FROM   sle.ReturnedSaleInvoice_NonPaymented
	           WHERE  ReturnedSaleInvoiceID = @ReturnedSaleInvoiceID
	                  AND NonPaymented < 0
	       )
	    BEGIN
	        RAISERROR('مبلغ وارد شده از مانده  بیشتر می باشد ', 16, 12)
	        RETURN
	    END
	
	IF @ReturnInvoiceID IS NOT NULL
	    IF EXISTS (
	           SELECT 1
	           FROM   vnd.ReturnInvoice_NonReceived
	           WHERE  ReturnInvoiceID = @ReturnInvoiceID
	                  AND NonReceived < 0
	       )
	    BEGIN
	        RAISERROR('مبلغ وارد شده از مانده  بیشتر می باشد ', 16, 12)
	        RETURN
	    END
	
	IF @CalculationResultID IS NOT NULL
	    IF EXISTS (
	           SELECT 1
	           FROM   Pay.CalculationResult_NonPayment
	           WHERE  CalculationResultID = @CalculationResultID
	                  AND Remain < 0
	       )
	    BEGIN
	        RAISERROR('مبلغ وارد شده از مانده  بیشتر می باشد ', 16, 12)
	        RETURN
	    END
