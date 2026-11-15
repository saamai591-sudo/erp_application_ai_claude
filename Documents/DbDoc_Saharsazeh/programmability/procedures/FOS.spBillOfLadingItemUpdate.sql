CREATE   PROC [FOS].[spBillOfLadingItemUpdate] 
    @BillOfLadingItemID int,
    @BillOfLadingID int,
	@RowIndex smallint,
    @PurchaseInvoiceItemID int,
    @MainQuantity decimal(30, 4),
    @SubQuantity decimal(30, 4),
	@SharingAmount decimal(36,10),
    @Description nvarchar(256),
    @Description2 nvarchar(256),
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
AS 
	SET NOCOUNT ON 

	if @Version=(Select [Version] from [FOS].[BillOfLadingItem]
	where [BillOfLadingItemID] = @BillOfLadingItemID)
	begin	

		declare @OldPurchase int,@OldMainQuantity decimal(30, 4),@OldSubQuantity decimal(30, 4) = null,
		@MainRemain decimal(30,4),@SubRemain decimal(30,4)

		select @OldPurchase = i.PurchaseInvoiceItemID,
			   @OldMainQuantity = i.MainQuantity,
			   @OldSubQuantity = i.SubQuantity
		from FOS.BillOfLadingItem i 
		where i.BillOfLadingItemID = @BillOfLadingItemID

		select @MainRemain = r.Non,
			   @SubRemain = r.NonSub
		from VND.PurchaseInvoice_Remains r
		where r.PurchaseInvoiceItemID = @PurchaseInvoiceItemID

		if (@OldPurchase <> @PurchaseInvoiceItemID)
		begin
			if (@MainQuantity > @MainRemain)
			begin
				raiserror('مقدار اصلی نمی تواند بیشتر از مانده بارنامه نشده اصلی فاکتور تامین کننده باشد.',16,12)
				return
			end

			if (@SubQuantity > @SubRemain)
			begin
				raiserror('مقدار فرعی  نمی تواند بیشتر از مانده بارنامه نشده فرعی فاکتور تامین کننده باشد.',16,12)
				return
			end
		end
		else 
		begin
			if (@OldMainQuantity <> @MainQuantity)
			begin
				if (@MainQuantity > @MainRemain + @OldMainQuantity)
				begin
					raiserror('مقدار اصلی نمی تواند بیشتر از مانده بارنامه نشده اصلی فاکتور تامین کننده باشد.',16,12)
					return
				end
			end
			

			if (@OldSubQuantity <> @SubQuantity)
			begin
				if (@SubQuantity > @SubRemain + @OldSubQuantity)
				begin
					raiserror('مقدار فرعی  نمی تواند بیشتر از مانده بارنامه نشده فرعی فاکتور تامین کننده باشد.',16,12)
					return
				end
			end
		end

		set @Version = @Version +1 

		UPDATE [FOS].[BillOfLadingItem]
		SET     [BillOfLadingID] = @BillOfLadingID, 
				[RowIndex] = @RowIndex,
				[PurchaseInvoiceItemID] = @PurchaseInvoiceItemID, 
				[MainQuantity] = @MainQuantity, 
				[SubQuantity] = @SubQuantity,
				[SharingAmount] = @SharingAmount,
				[Description] = @Description, 
				[Description2] = @Description2, 
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate, 
				[Version] = @Version
		WHERE  [BillOfLadingItemID] = @BillOfLadingItemID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   [FOS].[BillOfLadingItem]
		WHERE  [BillOfLadingItemID] = @BillOfLadingItemID	
		-- End Return Select <- do not remove

	end 
ELSE 
			RAISERROR('Version mismatch...', 16 , 10)
