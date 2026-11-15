CREATE   FUNCTION [CNT].[ContractHasFlow]
(
	@ContractID INT 
)
RETURNS BIT
--WITH ENCRYPTION
AS
    BEGIN
        DECLARE @Result BIT ,
            @Count INT

		-- Check Complement
        SET @Count = ISNULL(( SELECT    COUNT(ContractID)
                              FROM      CNT.Contract
                              WHERE     ParentID = @ContractID
                            ), 0)

        IF @Count > 0
            BEGIN
                RETURN 1
            END
		
		-- Check Continuation
        SET @Count = ISNULL(( SELECT    COUNT(*)
                              FROM      CNT.ContractContinuation
                              WHERE     ContractID = @ContractID
                            ), 0)

        IF @Count > 0
            BEGIN
                RETURN 1
            END

		----Check Contract Statement
        SET @Count = ISNULL(( SELECT    COUNT(*)
                              FROM      CNT.ContractStatement
                              WHERE     ContractID = @ContractID
                            ), 0)

        IF @Count > 0
            BEGIN
                RETURN 1
            END

		----Check Confirm Statement			
        SET @Count = ISNULL(
                     (   SELECT COUNT(1)
                         FROM   req.PaymentRequestItem a
						 join req.PaymentRequest b
							on a.PaymentRequestID = b.PaymentRequestID
                         WHERE  BaseDocumentType = 7
							and BaseDocumentID = @ContractID
							and b.Status <> 3 AND b.Status <> 5) ,
                     0);

        IF @Count > 0
            BEGIN
                RETURN 1
            END

		----Check Payment Commitment
        SET @Count = ISNULL(( SELECT    COUNT(*)
                              FROM      FIN.PaymentCommitment
                              WHERE     ContractID = @ContractID
                            ), 0)

        IF @Count > 0
            BEGIN
                RETURN 1
            END

		----Check Receive Commitment
        SET @Count = ISNULL(( SELECT    COUNT(*)
                              FROM      FIN.ReceiveCommitment
                              WHERE     ContractID = @ContractID
                            ), 0)

        IF @Count > 0
            BEGIN
                RETURN 1
            END
            
     		----Check DebitCredit Note
        SET @Count = ISNULL(( SELECT    COUNT(*)
                              FROM      cfg.DebitCreditNoteItem AS dcni
                              WHERE     dcni.ContractID = @ContractID
                            ), 0)

        IF @Count > 0
            BEGIN
                RETURN 1
            END       
            
            
             		----Check PaymentSubject
        SET @Count = ISNULL(( SELECT    COUNT(*)
                              FROM      fin.PaymentSubject AS ps
                              WHERE     ps.ContractID = @ContractID
                            ), 0)

        IF @Count > 0
            BEGIN
                RETURN 1
            END        

             		----Check TemporartyStockReceipt
        SET @Count = ISNULL(( SELECT    COUNT(*)
                              FROM      stc.TemporaryStockReceiptItem AS tsri
                              join cnt.ContractSubject AS cs on cs.ContractSubjectID = tsri.ContractSubjectID
                              WHERE     cs.ContractID = @ContractID
                            ), 0)

        IF @Count > 0
            BEGIN
                RETURN 1
            END   
            
        
             		----Check StockReceipt
        SET @Count = ISNULL(( SELECT    COUNT(*)
                              FROM      stc.StockReceiptItem AS sri
                              join cnt.ContractSubject AS cs on cs.ContractSubjectID = sri.ContractSubjectID
                              WHERE     cs.ContractID = @ContractID
                            ), 0)

        IF @Count > 0
            BEGIN
                RETURN 1
            END       
            
        
             		----Check PurchaseInvoice
        SET @Count = ISNULL(( SELECT    COUNT(*)
                              FROM      vnd.PurchaseInvoiceItem AS pii
                              join cnt.ContractSubject AS cs on cs.ContractSubjectID = pii.ContractSubjectID
                              WHERE     cs.ContractID = @ContractID
                            ), 0)

        IF @Count > 0
            BEGIN
                RETURN 1
            END           
            

        RETURN 0
    END
