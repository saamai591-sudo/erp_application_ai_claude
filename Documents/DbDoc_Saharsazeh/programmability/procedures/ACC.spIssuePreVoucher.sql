
CREATE   PROCEDURE [ACC].[spIssuePreVoucher]
(
    @documentType  VARCHAR(50),
    @documentId    VARCHAR(MAX),
	@CallFromIssueVoucher bit = 0
)

--WITH ENCRYPTION 
	 AS 

	DECLARE @CreatorId  INT,
	        @docTypeId  INT,
			@IdsForIssuePrevoucher VARCHAR(MAX)

	
	SET @CreatorId = cfg.GetuserID();

	SELECT [value] ID
	INTO #IdsForPrevoucher
	FROM   cfg.R_FnCommaStr2Table(@documentId) 	
	
	BEGIN TRY

		create table #Result
		(
			DocumentId int,
			ErrorMessage varchar(max),
			PrevoucherID int,
			DocDate Date,
			Number varchar(256)
		)
		
	IF @documentType = 'Invoice'
		BEGIN

			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.InvoiceID as varchar(50))
					    FROM   SLE.Invoice a
						join #IdsForPrevoucher b on a.InvoiceID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [SLE].spInvoicePreVoucherInsert  @IdsForIssuePrevoucher
		    END
		        
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.InvoiceID,null,PreVoucherID,Date,Number
				FROM   SLE.Invoice a
				join #IdsForPrevoucher b on a.InvoiceID = b.ID	
		END	
	IF @documentType = 'InvoiceCorrection'
		BEGIN

			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.InvoiceCorrectionID as varchar(50))
					    FROM   SLE.InvoiceCorrection a
						join #IdsForPrevoucher b on a.InvoiceCorrectionID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [SLE].spInvoiceCorrectionPreVoucherInsert  @IdsForIssuePrevoucher
		    END
		        
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.InvoiceCorrectionID,null,PreVoucherID,Date,Number
				FROM   SLE.InvoiceCorrection a
				join #IdsForPrevoucher b on a.InvoiceCorrectionID = b.ID	
		END	
		
	IF @documentType = 'ReturnedSaleInvoice'
		BEGIN
				
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.ReturnedSaleInvoiceID as varchar(50))
					    FROM   SLE.ReturnedSaleInvoice a
						join #IdsForPrevoucher b on a.ReturnedSaleInvoiceID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [SLE].spReturnedSaleInvoicePreVoucherInsert  @IdsForIssuePrevoucher
		    END
		   
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.ReturnedSaleInvoiceID,null,PreVoucherID,Date,Number
				FROM   SLE.ReturnedSaleInvoice a
				join #IdsForPrevoucher b on a.ReturnedSaleInvoiceID = b.ID	
		END		
		
	IF @documentType = 'PurchaseInvoice'
		BEGIN
			
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.PurchaseInvoiceID as varchar(50))
					    FROM   vnd.PurchaseInvoice a
						join #IdsForPrevoucher b on a.PurchaseInvoiceID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC vnd.spPurchaseInvoicePreVoucherInsert  @IdsForIssuePrevoucher
		    END			

			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.PurchaseInvoiceID,null,PreVoucherID,Date,Number
				FROM  vnd.PurchaseInvoice a
				join #IdsForPrevoucher b on a.PurchaseInvoiceID = b.ID	
		END
		
	IF @documentType = 'ReturnInvoice'
	BEGIN
		
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.ReturnInvoiceID as varchar(50))
					    FROM   vnd.ReturnInvoice a
						join #IdsForPrevoucher b on a.ReturnInvoiceID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC vnd.spReturnInvoicePreVoucherInsert  @IdsForIssuePrevoucher
		    END			

			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.ReturnInvoiceID,null,PreVoucherID,Date,Number
				FROM  vnd.ReturnInvoice a
				join #IdsForPrevoucher b on a.ReturnInvoiceID = b.ID	
	END
		
	IF @documentType = 'StockReceipt'
		BEGIN
			
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.StockReceiptID as varchar(50))
					    FROM   STC.StockReceipt a
						join #IdsForPrevoucher b on a.StockReceiptID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [STC].spStockReceiptPreVoucherInsert  @IdsForIssuePrevoucher
		    END
	   
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.StockReceiptID,null,PreVoucherID,Date,Number
				FROM  STC.StockReceipt a
				join #IdsForPrevoucher b on a.StockReceiptID = b.ID	
		END
		
	IF @documentType = 'ReturnStockReceipt'
		BEGIN
			
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.ReturnStockReceiptID as varchar(50))
					    FROM   STC.ReturnStockReceipt a
						join #IdsForPrevoucher b on a.ReturnStockReceiptID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [STC].spReturnStockReceiptPreVoucherInsert  @IdsForIssuePrevoucher
		    END
		   
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.ReturnStockReceiptID,null,PreVoucherID,Date,Number
				FROM  STC.ReturnStockReceipt a
				join #IdsForPrevoucher b on a.ReturnStockReceiptID = b.ID	

		END 
		
	IF @documentType = 'Outgoing'
		BEGIN
			
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.OutgoingID as varchar(50))
					    FROM   STC.Outgoing a
						join #IdsForPrevoucher b on a.OutgoingID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [STC].spOutgoingPreVoucherInsert  @IdsForIssuePrevoucher
		    END			
		   
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.OutgoingID,null,PreVoucherID,Date,Number
				FROM  STC.Outgoing a
				join #IdsForPrevoucher b on a.OutgoingID = b.ID	
		END
		
	IF @documentType = 'ReturnedOutgoing'
		BEGIN
			
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.ReturnedOutgoingID as varchar(50))
					    FROM   STC.ReturnedOutgoing a
						join #IdsForPrevoucher b on a.ReturnedOutgoingID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [STC].spReturnedOutgoingPreVoucherInsert  @IdsForIssuePrevoucher
		    END				

			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.ReturnedOutgoingID,null,PreVoucherID,Date,Number
				FROM  STC.ReturnedOutgoing a
				join #IdsForPrevoucher b on a.ReturnedOutgoingID = b.ID				
		END
		
	IF @documentType = 'RevisionCost'
		BEGIN
			
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.RevisionCostID as varchar(50))
					    FROM   STC.RevisionCost a
						join #IdsForPrevoucher b on a.RevisionCostID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [STC].spRevisionCostPreVoucherInsert  @IdsForIssuePrevoucher
		    END	

			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.RevisionCostID,null,PreVoucherID,Date,Number
				FROM  STC.RevisionCost a
				join #IdsForPrevoucher b on a.RevisionCostID = b.ID				   
		END	
		
	IF @documentType = 'ReceiveReceipt'
		BEGIN
			
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.ReceiveReceiptID as varchar(50))
					    FROM   FIN.ReceiveReceipt a
						join #IdsForPrevoucher b on a.ReceiveReceiptID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC FIN.spReceiveReceiptPreVoucherInsert  @IdsForIssuePrevoucher
		    END	
   
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.ReceiveReceiptID,null,PreVoucherID,Date,Number
				FROM  FIN.ReceiveReceipt a
				join #IdsForPrevoucher b on a.ReceiveReceiptID = b.ID	
		END	
		
	IF @documentType = 'PaymentReceipt'
		BEGIN
			
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.PaymentReceiptID as varchar(50))
					    FROM   FIN.PaymentReceipt a
						join #IdsForPrevoucher b on a.PaymentReceiptID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC FIN.spPaymentReceiptPreVoucherInsert  @IdsForIssuePrevoucher
		    END	

			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.PaymentReceiptID,null,PreVoucherID,Date,Number
				FROM  FIN.PaymentReceipt a
				join #IdsForPrevoucher b on a.PaymentReceiptID = b.ID	
				
		END			
		
	IF @documentType = 'ReceiptCheqeFlow'
		BEGIN
			
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.ReceiptCheqeFlowID as varchar(50))
					    FROM   FIN.ReceiptCheqeFlow a
						join #IdsForPrevoucher b on a.ReceiptCheqeFlowID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC FIN.spReceiptCheqeFlowPreVoucherInsert  @IdsForIssuePrevoucher
		    END				
		   
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.ReceiptCheqeFlowID,null,PreVoucherID,Date,Number
				FROM  FIN.ReceiptCheqeFlow a
				join #IdsForPrevoucher b on a.ReceiptCheqeFlowID = b.ID	
		END			
		
	IF @documentType = 'PaymentCheqeFlow'
		BEGIN
			
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.PaymentCheqeFlowID as varchar(50))
					    FROM   FIN.PaymentCheqeFlow a
						join #IdsForPrevoucher b on a.PaymentCheqeFlowID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC FIN.spPaymentCheqeFlowPreVoucherInsert  @IdsForIssuePrevoucher
		    END				
		   			
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.PaymentCheqeFlowID,null,PreVoucherID,Date,a.InnerNumber
				FROM  FIN.PaymentCheqeFlow a
				join #IdsForPrevoucher b on a.PaymentCheqeFlowID = b.ID	
	END			
		
	IF @documentType = 'ReceiveCommitment'
		BEGIN
			
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.ReceiveCommitmentID as varchar(50))
					    FROM   FIN.ReceiveCommitment a
						join #IdsForPrevoucher b on a.ReceiveCommitmentID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC FIN.spReceiveCommitmentPreVoucherInsert  @IdsForIssuePrevoucher
		    END			
					   			
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.ReceiveCommitmentID,null,PreVoucherID,Date,a.Number
				FROM  FIN.ReceiveCommitment a
				join #IdsForPrevoucher b on a.ReceiveCommitmentID = b.ID	
		END	
		
	IF @documentType = 'PaymentCommitment'
		BEGIN
			
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.PaymentCommitmentID as varchar(50))
					    FROM   FIN.PaymentCommitment a
						join #IdsForPrevoucher b on a.PaymentCommitmentID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC FIN.spPaymentCommitmentPreVoucherInsert  @IdsForIssuePrevoucher
		    END				

			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.PaymentCommitmentID,null,PreVoucherID,Date,a.Number
				FROM  FIN.PaymentCommitment a
				join #IdsForPrevoucher b on a.PaymentCommitmentID = b.ID	
			
		END	
	
	IF @documentType = 'PaymentCommitmentRecall'
		BEGIN
			
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.PaymentCommitmentRecallID as varchar(50))
					    FROM   FIN.PaymentCommitmentRecall a
						join #IdsForPrevoucher b on a.PaymentCommitmentRecallID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC FIN.spPaymentCommitmentRecallPreVoucherInsert  @IdsForIssuePrevoucher
		    END				

			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.PaymentCommitmentRecallID,null,PreVoucherID,Date,null
				FROM  FIN.PaymentCommitmentRecall a
				join #IdsForPrevoucher b on a.PaymentCommitmentRecallID = b.ID			   
		END		
	
	IF @documentType = 'ReceiveCommitmentRecall'
		BEGIN
			
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.ReceiveCommitmentRecallID as varchar(50))
					    FROM   FIN.ReceiveCommitmentRecall a
						join #IdsForPrevoucher b on a.ReceiveCommitmentRecallID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC FIN.spReceiveCommitmentRecallPreVoucherInsert  @IdsForIssuePrevoucher
		    END				
			
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.ReceiveCommitmentRecallID,null,PreVoucherID,Date,null
				FROM  FIN.ReceiveCommitmentRecall a
				join #IdsForPrevoucher b on a.ReceiveCommitmentRecallID = b.ID	

		END			

	IF @documentType = 'PettyCashCost'
	BEGIN

			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.PettyCashCostID as varchar(50))
					    FROM   FIN.PettyCashCost a
						join #IdsForPrevoucher b on a.PettyCashCostID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC FIN.spPettyCashCostPreVoucherInsert  @IdsForIssuePrevoucher
		    END			

			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.PettyCashCostID,null,PreVoucherID,Date,null
				FROM  FIN.PettyCashCost a
				join #IdsForPrevoucher b on a.PettyCashCostID = b.ID	
	   
	END	
		
	IF @documentType = 'DebitCreditNote'
	BEGIN
		
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.DebitCreditNoteID as varchar(50))
					    FROM   CFG.DebitCreditNote a
						join #IdsForPrevoucher b on a.DebitCreditNoteID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [CFG].spDebitCreditNotePreVoucherInsert  @IdsForIssuePrevoucher
		    END			

			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.DebitCreditNoteID,null,PreVoucherID,Date,Number
				FROM  CFG.DebitCreditNote a
				join #IdsForPrevoucher b on a.DebitCreditNoteID = b.ID	
		
	END	
		
	IF @documentType = 'AssetReceipt'
	BEGIN
		
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.AssetReceiptID as varchar(50))
					    FROM  AST.AssetReceipt  a
						join #IdsForPrevoucher b on a.AssetReceiptID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [AST].spAssetReceiptPreVoucherInsert  @IdsForIssuePrevoucher
		    END
			IF @CallFromIssueVoucher = 0 AND @IdsForIssuePrevoucher IS NULL
			BEGIN
			    INSERT INTO #Result 
			    SELECT 
			        a.AssetReceiptID,
			        'AssetManager.Messages.AssetReceiptAlreadyHasPreVoucher',
			        PreVoucherID,
			        Date,
			        Number
			    FROM AST.AssetReceipt a
			    JOIN #IdsForPrevoucher b 
			        ON a.AssetReceiptID = b.ID
			END	
   
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.AssetReceiptID,null,PreVoucherID,Date,Number
				FROM  AST.AssetReceipt a
				join #IdsForPrevoucher b on a.AssetReceiptID = b.ID	
	END	
		
	IF @documentType = 'Destruction'
	BEGIN
		
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.DestructionID as varchar(50))
					    FROM  AST.Destruction  a
						join #IdsForPrevoucher b on a.DestructionID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [AST].spDestructionPreVoucherInsert  @IdsForIssuePrevoucher
		    END			

			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.DestructionID,null,PreVoucherID,Date,Number
				FROM  AST.Destruction a
				join #IdsForPrevoucher b on a.DestructionID = b.ID	
	END	

	IF @documentType = 'Insurance'
	BEGIN
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.InsuranceID as varchar(50))
					    FROM  AST.Insurance  a
						join #IdsForPrevoucher b on a.InsuranceID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [AST].spInsurancePreVoucherInsert  @IdsForIssuePrevoucher
		    END				
		
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.InsuranceID,null,PreVoucherID,Date,Number
				FROM  AST.Insurance a
				join #IdsForPrevoucher b on a.InsuranceID = b.ID	
	END	

	IF @documentType = 'Sale'
	BEGIN
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.SaleID as varchar(50))
					    FROM  AST.Sale  a
						join #IdsForPrevoucher b on a.SaleID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [AST].spSalePreVoucherInsert  @IdsForIssuePrevoucher
		    END				
	   
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.SaleID,null,PreVoucherID,Date,Number
				FROM  AST.Sale a
				join #IdsForPrevoucher b on a.SaleID = b.ID	
	END	

	IF @documentType = 'Salvage'
	BEGIN
	
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.SalvageID as varchar(50))
					    FROM  AST.Salvage  a
						join #IdsForPrevoucher b on a.SalvageID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [AST].spSalvagePreVoucherInsert  @IdsForIssuePrevoucher
		    END				
	   
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.SalvageID,null,PreVoucherID,Date,Number
				FROM  AST.Salvage a
				join #IdsForPrevoucher b on a.SalvageID = b.ID	
	END	

	IF @documentType = 'Repair'
	BEGIN
	
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.RepairID as varchar(50))
					    FROM  AST.Repair  a
						join #IdsForPrevoucher b on a.RepairID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN

				insert into #Result(DocumentId,ErrorMessage)
				EXEC [AST].spRepairPreVoucherInsert  @IdsForIssuePrevoucher
		    END				
 
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.RepairID,null,PreVoucherID,Date,Number
				FROM  AST.Repair a
				join #IdsForPrevoucher b on a.RepairID = b.ID	
	END	

	IF @documentType = 'Adjustment'
	BEGIN
		
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.AdjustmentID as varchar(50))
					    FROM  AST.Adjustment  a
						join #IdsForPrevoucher b on a.AdjustmentID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [AST].spAdjustmentPreVoucherInsert  @IdsForIssuePrevoucher
		    END				
   
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.AdjustmentID,null,PreVoucherID,Date,Number
				FROM  AST.Adjustment a
				join #IdsForPrevoucher b on a.AdjustmentID = b.ID	
	END	

	IF @documentType = 'Revaluation'
	BEGIN
		
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.RevaluationID as varchar(50))
					    FROM  AST.Revaluation  a
						join #IdsForPrevoucher b on a.RevaluationID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [AST].spRevaluationPreVoucherInsert  @IdsForIssuePrevoucher
		    END	
			
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.RevaluationID,null,PreVoucherID,Date,Number
				FROM  AST.Revaluation a
				join #IdsForPrevoucher b on a.RevaluationID = b.ID	
	   
	END	

	IF @documentType = 'GuarantyOperation'
	BEGIN
		
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.GuarantyOperationID as varchar(50))
					    FROM  FIN.GuarantyOperation  a
						join #IdsForPrevoucher b on a.GuarantyOperationID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC FIN.spGaranteeOperationPreVoucherInsert  @IdsForIssuePrevoucher
		    END				
	   
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.GuarantyOperationID,null,PreVoucherID,Date,Number
				FROM  FIN.GuarantyOperation a
				join #IdsForPrevoucher b on a.GuarantyOperationID = b.ID	
	END	

	IF @documentType = 'Transfer'
	BEGIN
		
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.TransferID as varchar(50))
					    FROM  ast.Transfer  a
						join #IdsForPrevoucher b on a.TransferID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [AST].spTransferPreVoucherInsert  @IdsForIssuePrevoucher
		    END	

	   
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.TransferID,null,PreVoucherID,Date,Number
				FROM  ast.Transfer a
				join #IdsForPrevoucher b on a.TransferID = b.ID	
   
	END	
	
	IF @documentType = 'ReceivedFromBranch'
	BEGIN
		
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.ReceivedFromBranchID as varchar(50))
					    FROM  ast.ReceivedFromBranch  a
						join #IdsForPrevoucher b on a.ReceivedFromBranchID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [AST].spReceivedFromBranchPreVoucherInsert  @IdsForIssuePrevoucher
		    END	

	   
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.ReceivedFromBranchID,null,PreVoucherID,Date,Number
				FROM  ast.ReceivedFromBranch a
				join #IdsForPrevoucher b on a.ReceivedFromBranchID = b.ID	
   
	END	
	
	IF @documentType = 'Delivery'
	BEGIN
	
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.DeliveryID as varchar(50))
						FROM  POS.Delivery  a
						join #IdsForPrevoucher b on a.DeliveryID = b.ID	               
						where a.PreVoucherID is null
						FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
			IF (@IdsForIssuePrevoucher Is Not NULL)
			BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [pos].spPosDeliverySalePreVoucherInsert  @IdsForIssuePrevoucher
			END	

			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.DeliveryID,null,PreVoucherID,Date,Number
				FROM  POS.Delivery a
				join #IdsForPrevoucher b on a.DeliveryID = b.ID	
	END

	IF @documentType = 'Registration'
	BEGIN
		
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.RegistrationID as varchar(50))
					    FROM  fos.Registration  a
						join #IdsForPrevoucher b on a.RegistrationID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [fos].spRegistrationPreVoucherInsert  @IdsForIssuePrevoucher
		    END	
   
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.RegistrationID,null,PreVoucherID,Date,Number
				FROM  fos.Registration a
				join #IdsForPrevoucher b on a.RegistrationID = b.ID	
	END	


	IF @documentType = 'ShippingInsurance'
	BEGIN
		
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.ShippingInsuranceID as varchar(50))
					    FROM  fos.ShippingInsurance  a
						join #IdsForPrevoucher b on a.ShippingInsuranceID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [fos].spShippingInsurancePreVoucherInsert  @IdsForIssuePrevoucher
		    END	
   
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.ShippingInsuranceID,null,PreVoucherID,Date,Number
				FROM  fos.ShippingInsurance a
				join #IdsForPrevoucher b on a.ShippingInsuranceID = b.ID	
	END	


	IF @documentType = 'LetterCredit'
	BEGIN
		
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.LetterCreditID as varchar(50))
					    FROM  fos.LetterCredit  a
						join #IdsForPrevoucher b on a.LetterCreditID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [fos].spLetterCreditPreVoucherInsert  @IdsForIssuePrevoucher
		    END	
   
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.LetterCreditID,null,PreVoucherID,Date,Number
				FROM  fos.LetterCredit a
				join #IdsForPrevoucher b on a.LetterCreditID = b.ID	
	END	


	IF @documentType = 'BillOfLading'
	BEGIN
		
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.BillOfLadingID as varchar(50))
					    FROM  fos.BillOfLading  a
						join #IdsForPrevoucher b on a.BillOfLadingID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [fos].spBillOfLadingPreVoucherInsert  @IdsForIssuePrevoucher
		    END	

			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.BillOfLadingID,null,PreVoucherID,Date,Number
				FROM  fos.BillOfLading a
				join #IdsForPrevoucher b on a.BillOfLadingID = b.ID	
   
	END	


	IF @documentType = 'CostOfOrder'
	BEGIN
		
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.CostOfOrderID as varchar(50))
					    FROM  fos.CostOfOrder  a
						join #IdsForPrevoucher b on a.CostOfOrderID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [fos].spCostOfOrderPreVoucherInsert  @IdsForIssuePrevoucher
		    END	
   
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.CostOfOrderID,null,PreVoucherID,Date,Number
				FROM  fos.CostOfOrder a
				join #IdsForPrevoucher b on a.CostOfOrderID = b.ID	
	END	


	IF @documentType = 'Clearance'
		BEGIN
						
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.ClearanceID as varchar(50))
					    FROM  fos.Clearance  a
						join #IdsForPrevoucher b on a.ClearanceID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [fos].spClearancePreVoucherInsert  @IdsForIssuePrevoucher
		    END	

			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.ClearanceID,null,PreVoucherID,Date,Number
				FROM  fos.Clearance a
				join #IdsForPrevoucher b on a.ClearanceID = b.ID	

		END

	IF @documentType = 'OrderPricing'
	BEGIN
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.OrderPricingID as varchar(50))
					    FROM  fos.OrderPricing  a
						join #IdsForPrevoucher b on a.OrderPricingID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [fos].spOrderPricingPreVoucherInsert  @IdsForIssuePrevoucher
		    END	

			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.OrderPricingID,null,PreVoucherID,Date,Number
				FROM  fos.OrderPricing a
				join #IdsForPrevoucher b on a.OrderPricingID = b.ID	

	END

	IF @documentType = 'CreditAllocation'
	BEGIN
						
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.CreditAllocationID as varchar(50))
					    FROM  fos.CreditAllocation  a
						join #IdsForPrevoucher b on a.CreditAllocationID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [fos].spCreditAllocationPreVoucherInsert  @IdsForIssuePrevoucher
		    END	

			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.CreditAllocationID,null,PreVoucherID,Date,Number
				FROM  fos.CreditAllocation a
				join #IdsForPrevoucher b on a.CreditAllocationID = b.ID	
	END

	IF @documentType = 'ConfirmStatement'
	BEGIN
						
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.ConfirmStatementID as varchar(50))
					    FROM   cnt.ConfirmStatement  a
						join #IdsForPrevoucher b on a.ConfirmStatementID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [CNT].spConfirmStatementPreVoucherInsert  @IdsForIssuePrevoucher
		    END	


			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.ConfirmStatementID,null,PreVoucherID,Date,Number
				FROM  cnt.ConfirmStatement a
				join #IdsForPrevoucher b on a.ConfirmStatementID = b.ID	

	END

	IF @documentType = 'Modification'
	BEGIN
						
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.ModificationID as varchar(50))
					    FROM   noc.Modification  a
						join #IdsForPrevoucher b on a.ModificationID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [NOC].spModificationPreVoucherInsert  @IdsForIssuePrevoucher
		    END	

			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.ModificationID,null,PreVoucherID,Date,Number
				FROM  noc.Modification a
				join #IdsForPrevoucher b on a.ModificationID = b.ID	

	END

	IF @documentType = 'ChangeCategory'
	BEGIN
		
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.ChangeCategoryID as varchar(50))
					    FROM  ast.ChangeCategory  a
						join #IdsForPrevoucher b on a.ChangeCategoryID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [AST].spChangeCategoryPreVoucherInsert  @IdsForIssuePrevoucher
		    END	
   
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.ChangeCategoryID,null,PreVoucherID,Date,Number
				FROM  ast.ChangeCategory a
				join #IdsForPrevoucher b on a.ChangeCategoryID = b.ID	
	END

	IF @documentType = 'AccCurrencyExchange'
	BEGIN
		
			SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.AccCurrencyExchangeID as varchar(50))
					    FROM  ACC.AccCurrencyExchange  a
						join #IdsForPrevoucher b on a.AccCurrencyExchangeID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher IS NOT NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC [ACC].[spAccCurrencyExchangePrevoucherInsert]  @IdsForIssuePrevoucher
		    END	
   
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.AccCurrencyExchangeID, null, PreVoucherID, Date, Number
				FROM  ACC.AccCurrencyExchange a
				join #IdsForPrevoucher b on a.AccCurrencyExchangeID = b.ID	
	END

	IF @documentType = 'ConfirmPurchaseInvoice'
	BEGIN
		
SELECT @IdsForIssuePrevoucher = 
			STUFF((SELECT DISTINCT ',' + cast(a.ConfirmPurchaseInvoiceID as varchar(50))
					    FROM  VND.ConfirmPurchaseInvoice  a
						join #IdsForPrevoucher b on a.ConfirmPurchaseInvoiceID = b.ID	               
						where a.PreVoucherID is null
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
			
		    IF (@IdsForIssuePrevoucher Is Not NULL)
		    BEGIN
				insert into #Result(DocumentId,ErrorMessage)
				EXEC   [VND].[ConfirmPurchaseInvoicePreVoucherInsert] @IdsForIssuePrevoucher
		    END	
   
			IF NOT EXISTS (select * from #Result) 
				insert into #Result 
				SELECT a.ConfirmPurchaseInvoiceID,null,a.PreVoucherID,Date,Number
				FROM  VND.ConfirmPurchaseInvoice a
				join #IdsForPrevoucher b on a.ConfirmPurchaseInvoiceID = b.ID	
	END

	if @CallFromIssueVoucher = 1
		insert into #IssuePrevoucherResult
		SELECT *,@documentType FROM #Result
	else
		SELECT * FROM #Result

	END Try
	
	BEGIN CATCH
	
			
		DECLARE @err NVARCHAR(MAX) ,@S INT,@State int
		set @err =ERROR_MESSAGE()
		SET @S=ERROR_SEVERITY()
		SET @State=ERROR_STATE()
		
		
		RAISERROR (@err, -- Message text.
					@S, -- Severity,
					@State -- State,
					); -- Second argument.
		
		
	END CATCH


