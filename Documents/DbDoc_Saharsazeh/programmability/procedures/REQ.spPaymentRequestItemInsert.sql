
CREATE   PROC REQ.spPaymentRequestItemInsert
    @PaymentRequestID int,
    @RowIndex smallint,
    @BaseDocumentType tinyint,
    @BaseDocumentID int,
    @CurrencyID int,
	@Amount decimal(36, 10),
	@Description nvarchar(MAX),
    @Description2 nvarchar(MAX),
    @Creator int,
    @CreationDate datetime,
	@PartyID BIGINT, 
	@PartyAccountID INT
--WITH ENCRYPTION 
AS 
SET NOCOUNT ON 
BEGIN
	declare @PaymentRequestItemID int

	INSERT INTO [REQ].PaymentRequestItem (PaymentRequestID, RowIndex, BaseDocumentType, BaseDocumentID,
		CurrencyID, Amount, [Description], [Description2], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate],
		[PartyID], [PartyAccountID])
	SELECT @PaymentRequestID, @RowIndex, @BaseDocumentType, @BaseDocumentID, 
	       @CurrencyID, @Amount, @Description,@Description2, 0, @Creator, @CreationDate, @Creator, @CreationDate,
		   @PartyID, @PartyAccountID
	
	SET @PaymentRequestItemID = SCOPE_IDENTITY()

	if @BaseDocumentType = 2
	BEGIN
	IF
	(SELECT NonRequested
	FROM VND.vwPurchaseInvoice_NonRequested
	WHERE PurchaseInvoiceID = @BaseDocumentID) < 0
	BEGIN
		RAISERROR('RequestManager.RemainOfBaseDocumentCanNotBeNegative',16,12)
		RETURN
	END
	END

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
		where ContractID = @BaseDocumentID and CurrencyID = @CurrencyID) < 0
		begin
			RAISERROR('RequestManager.RemainOfBaseDocumentCanNotBeNegative',16,12)
			RETURN 0
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
			RETURN 0
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
				RETURN 0
			end
	end

	-- Begin Return Select <- do not remove
	SELECT PaymentRequestItemID,[Version]
	FROM   [REQ].PaymentRequestItem
	WHERE  PaymentRequestItemID = @PaymentRequestItemID
	-- End Return Select <- do not remove
END 
