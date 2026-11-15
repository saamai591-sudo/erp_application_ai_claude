
----------------------------------------------------------MODIFY [FOS].[spCostOfOrderItemUpdate]-------------------------------------
CREATE    PROC [FOS].[spCostOfOrderItemUpdate]
    @CostOfOrderItemID int,
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
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
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

	if @Version=(Select [Version] from FOS.CostOfOrderItem
	where CostOfOrderItemID = @CostOfOrderItemID)
	begin	
		set @Version = @Version +1 

		UPDATE [FOS].CostOfOrderItem
		SET    [CostOfOrderID] = @CostOfOrderID, 
			   [RowIndex] = @RowIndex,
			   [SpecialCostID] = @SpecialCostID, 
			   [CurrencyID] = @CurrencyID,
			   [PurchaseInvoiceItemID] = @PurchaseInvoiceItemID, 
			   [CurrencyRate] = @CurrencyRate,
			   [Amount] = @Amount, 
			   [PartyID] = @PartyID,			   
			   [Description] = @Description, 
			   [Description2] = @Description2, 
			   [LastEditor] = @LastEditor, 
			   [LastEditionDate] = @LastEditionDate, 
			   [Version] = @Version
		WHERE  CostOfOrderItemID = @CostOfOrderItemID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   [FOS].CostOfOrderItem
		WHERE  CostOfOrderItemID = @CostOfOrderItemID	
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

	end
ELSE 
	RAISERROR('Version mismatch...', 16 , 10)
