
CREATE   PROC REQ.spPaymentRequestItemUpdate
    @PaymentRequestItemID int,
	@PaymentRequestID int,
    @RowIndex smallint,
    @BaseDocumentType tinyint,
    @BaseDocumentID int,
    @CurrencyID int,
	@Amount decimal(36, 10),
	@Description nvarchar(MAX),
    @Description2 nvarchar(MAX),
    @Version int,
    @LastEditor int,
    @LastEditionDate DATETIME,
	@PartyID BIGINT, 
	@PartyAccountID INT
--WITH ENCRYPTION 
AS 
SET NOCOUNT ON 

	if @Version <> (Select [Version] from [REQ].PaymentRequestItem
				where PaymentRequestItemID = @PaymentRequestItemID)
	RAISERROR('Version mismatch...', 16 , 10)

	UPDATE [REQ].PaymentRequestItem
		SET    PaymentRequestID = @PaymentRequestID,
			   RowIndex = @RowIndex,
			   BaseDocumentType = @BaseDocumentType,
		       BaseDocumentID = @BaseDocumentID,
			   CurrencyID = @CurrencyID, 
		       Amount = @Amount,		     
		       [Description] = @Description,
		       [Description2] = @Description2, 
		       [Version] = @Version + 1,		      
		       [LastEditor] = @LastEditor, 
		       [LastEditionDate] = @LastEditionDate,
			   [PartyID] = @PartyID,
			   [PartyAccountID] = @PartyAccountID
		WHERE  PaymentRequestItemID = @PaymentRequestItemID
	
	if @BaseDocumentType = 2
	begin
	if
	(select NonRequested
	from VND.vwPurchaseInvoice_NonRequested
	where PurchaseInvoiceID = @BaseDocumentID) < 0
	begin
		RAISERROR('RequestManager.RemainOfBaseDocumentCanNotBeNegative',16,12)
		RETURN
	end
	end

	if @BaseDocumentType = 3
	begin
	if
	(select NonRequested
	from SLE.vwReturnedSaleInvoice_NonRequested
	where ReturnedSaleInvoiceID = @BaseDocumentID) < 0
	begin
		RAISERROR('RequestManager.RemainOfBaseDocumentCanNotBeNegative',16,12)
		RETURN
	end
	end

	if @BaseDocumentType = 4
	begin
	if
	(select Remain
	from CNT.vwConfirmStatement_NonRequested
	where ConfirmStatementID = @BaseDocumentID) < 0
	begin
		RAISERROR('RequestManager.RemainOfBaseDocumentCanNotBeNegative',16,12)
		RETURN
	end
	end

	if @BaseDocumentType = 5
	begin
	if
	(select VatRemain
	from CNT.vwContractStatementRemain
	where ContractStatementID = @BaseDocumentID) < 0
	begin
		RAISERROR('RequestManager.RemainOfBaseDocumentCanNotBeNegative',16,12)
		RETURN
	end
	end

	if @BaseDocumentType = 6
	begin
	if
	(select Remain
	from CNT.vwConfirmStatementItemNonRequestedRemain
	where ConfirmStatementItemID = @BaseDocumentID) < 0
	begin
		RAISERROR('RequestManager.RemainOfBaseDocumentCanNotBeNegative',16,12)
		RETURN
	end
	end

	if @BaseDocumentType = 7
	begin
	if
	(select Remain
	from CNT.vwContractNonRequestedRemain
	where ContractID = @BaseDocumentID and CurrencyID = @CurrencyID
	
	) < 0
	begin
		RAISERROR('RequestManager.RemainOfBaseDocumentCanNotBeNegative',16,12)
		RETURN
	end
	end

	if @BaseDocumentType = 8
	begin
	if
	(select NonRequested
	from VND.Proposal_NonRequested
	where ProposalID = @BaseDocumentID) < 0
	begin
		RAISERROR('RequestManager.RemainOfBaseDocumentCanNotBeNegative',16,12)
		RETURN
	end
	end

	if @BaseDocumentType = 9
		begin
		if
		(select NonRequested
		from VND.PurchaseContract_NonRequested
		where PurchaseContractID = @BaseDocumentID) < 0
		begin
			RAISERROR('RequestManager.RemainOfBaseDocumentCanNotBeNegative',16,12)
			RETURN
		end
	end

	-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   [REQ].PaymentRequestItem
	WHERE  PaymentRequestItemID = @PaymentRequestItemID
	-- End Return Select <- do not remove
