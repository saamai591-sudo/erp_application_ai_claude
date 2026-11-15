CREATE   PROC [FOS].[spBillOfLadingItemInsert] 
    @BillOfLadingID int,
	@RowIndex smallint,
    @PurchaseInvoiceItemID int,
    @MainQuantity decimal(30, 4),
    @SubQuantity decimal(30, 4),
	@SharingAmount decimal(36,10),
    @Description nvarchar(256),
    @Description2 nvarchar(256),
    @Creator int,
    @CreationDate datetime
AS 
BEGIN
	SET NOCOUNT ON 

	declare @MainRemain decimal(30,4),@SubRemain decimal(30,4)

	select @MainRemain = r.Non,
		   @SubRemain = r.NonSub
	from VND.PurchaseInvoice_Remains r
	where r.PurchaseInvoiceItemID = @PurchaseInvoiceItemID

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
	
	INSERT INTO [FOS].[BillOfLadingItem] ([BillOfLadingID],[RowIndex], [PurchaseInvoiceItemID], [MainQuantity], [SubQuantity],[SharingAmount], [Description], [Description2], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version])
	SELECT @BillOfLadingID,@RowIndex, @PurchaseInvoiceItemID, @MainQuantity, @SubQuantity,@SharingAmount,@Description, @Description2, @Creator, @CreationDate, @Creator, @CreationDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT [BillOfLadingItemID], [Version]
	FROM   [FOS].[BillOfLadingItem]
	WHERE  [BillOfLadingItemID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
END
