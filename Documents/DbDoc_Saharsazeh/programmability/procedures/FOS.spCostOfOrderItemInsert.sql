
----------------------------------------------------------MODIFY [FOS].[spCostOfOrderItemInsert]-------------------------------------
CREATE    PROC [FOS].[spCostOfOrderItemInsert]
    @CostOfOrderID int,
    @RowIndex smallint,
    @SpecialCostID int,
	@CurrencyID int,
    @PurchaseInvoiceItemID int,
	@CurrencyRate DECIMAL(20, 10),
	@Amount decimal(30, 4),
	@PartyID bigint,
	@Description nvarchar(256),
	@Description2 nvarchar(256),    
    @Creator int,
    @CreationDate datetime
--WITH ENCRYPTION
AS 
BEGIN
	SET NOCOUNT ON 

	if (@PurchaseInvoiceItemID is null)
	begin
		declare @Date date,
		        @maxDate date

		select @Date = [Date] from FOS.CostOfOrder where CostOfOrderID = @CostOfOrderID	
		SELECT @maxDate = MAX(EndDate) FROM cfg.Vat v
	
		IF @maxDate IS NOT NULL
		   AND @maxDate >= @Date
		BEGIN 	    
			RAISERROR('VatHasPublished', 16, 12)
		END
	end
	
	INSERT INTO FOS.CostOfOrderItem ([CostOfOrderID], [RowIndex], [SpecialCostID], [CurrencyID], [PurchaseInvoiceItemID], [CurrencyRate],
	[Amount], [PartyID], [Description], [Description2], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version])
	SELECT @CostOfOrderID, @RowIndex, @SpecialCostID, @CurrencyID, @PurchaseInvoiceItemID, @CurrencyRate, @Amount, @PartyID,
	@Description, @Description2, @Creator, @CreationDate, @Creator, @CreationDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT CostOfOrderItemID,[Version]
	FROM   FOS.CostOfOrderItem
	WHERE  CostOfOrderItemID = SCOPE_IDENTITY()
	-- End Return Select <- do not remove

	if (@PurchaseInvoiceItemID is not null)
	begin
		declare @Number int, @Remain decimal(30,4), @Message NVARCHAR(MAX)
		select @Number = p.Number,
		       @Remain = r.Non 
		from VND.PurchaseInvoiceItem i
		join VND.PurchaseInvoice p on i.PurchaseInvoiceID = p.PurchaseInvoiceID
		join VND.PurchaseInvoice_PriceRemains r on i.PurchaseInvoiceItemID = r.PurchaseInvoiceItemID
		where i.PurchaseInvoiceItemID = @PurchaseInvoiceItemID

		if (@Remain < 0)
		begin
			set @Message = 'مانده تسویه نشده فاکتور تامین کننده به شماره {0} منفی خواهد شد.'
			
			SET @Message= REPLACE(@Message, '{0}', @Number)
			RAISERROR(@Message,16,12)
			return
		end
	end
END
