-------------------------------------
CREATE    PROCEDURE [ACC].[spViewPreVoucher](
    @documentType  VARCHAR(50),
    @documentId    INT = 0
)

--WITH ENCRYPTION 
	 AS 
DECLARE  @PreVoucherId INT,
	        @docTypeId  INT
	
	
		
	IF @documentType = 'Invoice'
		BEGIN
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   SLE.Invoice
		    WHERE  InvoiceID = @documentId
		    
		   
		END	
	IF @documentType = 'InvoiceCorrection'
		BEGIN
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   SLE.InvoiceCorrection
		    WHERE  InvoiceCorrectionID = @documentId
		    
		   
		END	
		
	IF @documentType = 'ReturnedSaleInvoice'
		BEGIN
				
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   SLE.ReturnedSaleInvoice
		    WHERE  ReturnedSaleInvoiceID = @documentId
		    
		    
		   
		END		
		
	IF @documentType = 'PurchaseInvoice'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   vnd.PurchaseInvoice pi1
		    WHERE pi1.PurchaseInvoiceID = @documentId
		    
		  
		    
		 
		    
		 
		   
		END
		
	IF @documentType = 'ReturnInvoice'
	BEGIN
		
		
		
	    SELECT @PreVoucherId = PreVoucherID
	    FROM   vnd.ReturnInvoice  pi1
	    WHERE pi1.ReturnInvoiceID = @documentId
	    
	  
	    
	 
	   
	END
		
	IF @documentType = 'StockReceipt'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   STC.StockReceipt 
		    WHERE StockReceiptID = @documentId
		    
		  
		   
		    
		 
		   
		END
		
	IF @documentType = 'ReturnStockReceipt'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   STC.ReturnStockReceipt  
		    WHERE ReturnStockReceiptID = @documentId
		    
		   
		   
		    
		  
		   
		END 
		
	IF @documentType = 'Outgoing'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   STC.Outgoing  
		    WHERE OutgoingID = @documentId
		    
		 
		   
		   
		END
		
	IF @documentType = 'ReturnedOutgoing'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   STC.ReturnedOutgoing  
		    WHERE ReturnedOutgoingID = @documentId
		    
		  
		   
		   
		   
		END
		
	IF @documentType = 'RevisionCost'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   STC.RevisionCost  
		    WHERE RevisionCostID = @documentId
		    
		  
		   
		   
		   
		END
		
	IF @documentType = 'ReceiveReceipt'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   FIN.ReceiveReceipt  
		    WHERE ReceiveReceiptID = @documentId
		    
		  
		   
		   
		   
		END
		
	IF @documentType = 'ReceiptCheqeFlow'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   FIN.ReceiptCheqeFlow  
		    WHERE ReceiptCheqeFlowID = @documentId
		    
		  
		   
		   
		   
		END
		
	IF @documentType = 'ReceiveCommitment'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   FIN.ReceiveCommitment  
		    WHERE ReceiveCommitmentID = @documentId
		    
		  
		   
		   
		   
		END
		
	IF @documentType = 'PaymentReceipt'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   FIN.PaymentReceipt  
		    WHERE PaymentReceiptID = @documentId
		    
		  
		   
		   
		   
		END		
		
	IF @documentType = 'PaymentCheqeFlow'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   FIN.PaymentCheqeFlow  
		    WHERE PaymentCheqeFlowID = @documentId
		    
		  
		   
		   
		   
		END
		
	IF @documentType = 'PaymentCommitment'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   FIN.PaymentCommitment  
		    WHERE PaymentCommitmentID = @documentId
		    
		  
		   
		   
		   
		END
	
	IF @documentType = 'PaymentCommitmentRecall'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   FIN.PaymentCommitmentRecall
		    WHERE PaymentCommitmentRecallID = @documentId
		    
		  
		   
		   
		   
		END	
		
	IF @documentType = 'ReceiveCommitmentRecall'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   FIN.ReceiveCommitmentRecall
		    WHERE ReceiveCommitmentRecallID = @documentId
		    
		  
		   
		   
		   
		END	
		
	IF @documentType = 'DebitCreditNote'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   CFG.DebitCreditNote 
		    WHERE DebitCreditNoteID = @documentId
		    
		  
		   
		   
		   
		END
		
	IF @documentType = 'PettyCashCost'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   FIN.PettyCashCost  
		    WHERE PettyCashCostID = @documentId  
		  
		   
		   
		   
		END

	IF @documentType = 'AssetReceipt'
	BEGIN
		
		
		
	    SELECT @PreVoucherId = PreVoucherID
	    FROM   ast.AssetReceipt
	    WHERE AssetReceiptID = @documentId  
	  
	   
	   
	   
	END

	IF @documentType = 'Destruction'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   ast.Destruction
		    WHERE DestructionID = @documentId  
		  
		   
		   
		   
		END

	IF @documentType = 'Insurance'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   ast.Insurance
		    WHERE InsuranceID = @documentId  
		  
		   
		   
		   
		END

	IF @documentType = 'Sale'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   ast.Sale
		    WHERE SaleID = @documentId  
		  
		   
		   
		   
		END
				
	IF @documentType = 'Salvage'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   ast.Salvage
		    WHERE SalvageID = @documentId  
		  
		   
		   
		   
		END

	IF @documentType = 'Repair'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   ast.Repair
		    WHERE RepairID = @documentId  
		  
		   
		   
		   
		END
			IF @documentType = 'Adjustment'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   ast.Adjustment
		    WHERE AdjustmentID = @documentId  
		  
		   
		   
		   
		END

			IF @documentType = 'Revaluation'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   ast.Revaluation
		    WHERE RevaluationID = @documentId  
		  
		   
		   
		   
		END

			IF @documentType = 'GuarantyOperation'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   FIN.GuarantyOperation
		    WHERE GuarantyOperationID = @documentId  
		  
		   
		   
		   
		END

			IF @documentType = 'Transfer'
		BEGIN
			
			
			
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   ast.Transfer
		    WHERE TransferID = @documentId  
		  
		   
		   
		   
		END

			IF @documentType = 'Registration'
		BEGIN
						
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   fos.Registration
		    WHERE RegistrationID = @documentId     

		END

			IF @documentType = 'ShippingInsurance'
		BEGIN
						
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   fos.ShippingInsurance
		    WHERE ShippingInsuranceID = @documentId     

		END

			IF @documentType = 'LetterCredit'
		BEGIN
						
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   fos.LetterCredit
		    WHERE LetterCreditID = @documentId     

		END

			IF @documentType = 'BillOfLading'
		BEGIN
						
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   fos.BillOfLading
		    WHERE BillOfLadingID = @documentId     

		END


			IF @documentType = 'CostOfOrder'
		BEGIN
						
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   fos.CostOfOrder
		    WHERE CostOfOrderID = @documentId     

		END

			IF @documentType = 'ChangeCategory'
		BEGIN
						
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   AST.ChangeCategory
		    WHERE ChangeCategoryID = @documentId     

		END

			IF @documentType = 'Clearance'
		BEGIN
						
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   fos.Clearance
		    WHERE ClearanceID = @documentId     

		END

			IF @documentType = 'OrderPricing'
		BEGIN
						
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   fos.OrderPricing
		    WHERE OrderPricingID = @documentId     

		END

			IF @documentType = 'ConfirmStatement'
		BEGIN
						
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   cnt.ConfirmStatement
		    WHERE ConfirmStatementID = @documentId     

		END

			IF @documentType = 'CreditAllocation'
		BEGIN
						
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   fos.CreditAllocation
		    WHERE CreditAllocationID = @documentId     

		END


			IF @documentType = 'Modification'
		BEGIN
						
		    SELECT @PreVoucherId = PreVoucherID
		    FROM   noc.Modification
		    WHERE ModificationID = @documentId     

		END

	IF @documentType = 'PreVoucher'
		BEGIN
			
			SET @PreVoucherId = @documentId		   
		   
		END
	
	EXEC ACC.GetPreVoucher @PreVoucherId

