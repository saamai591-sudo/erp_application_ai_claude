CREATE    PROC [AST].[SpAdjustmentItemInsert]
    @AdjustmentID int,
    @AssetID int,
	@BaseDocumentType Tinyint,
	@BaseDocumentID int,
    @Amount decimal(30, 4),
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime 
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 	

	declare @Plaque varchar(50) = null,
			@Date date

	select @Plaque = Plaque from AST.Asset where AssetID = @AssetID
	select @Date = [Date] from AST.Adjustment where AdjustmentID = @AdjustmentID

		if exists (select 1 from AST.Depreciation d
	        join AST.AssetSetting ass on d.AssetSettingID = ass.AssetSettingID
			where ass.AssetID = @AssetID and d.Date >= @Date
			)
	begin
		raiserror('برای پلاک دارایی (%s) به تاریخ بزرگتر مساوی تاریخ وارد شده، محاسبه استهلاک انجام شده است. بنابراین نمی توان برای این دارایی تغییر بها صادر نمود.',16,12,@Plaque)
		return
	end

	INSERT INTO [AST].[AdjustmentItem] ([AdjustmentID], [AssetID],BaseDocumentType, BaseDocumentID, [Amount], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @AdjustmentID, @AssetID,@BaseDocumentType, @BaseDocumentID, @Amount, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [AdjustmentItemID], [Version]
	FROM   [AST].[AdjustmentItem]
	WHERE  [AdjustmentItemID] = SCOPE_IDENTITY()

	-- End Return Select <- do not remove
	if @BaseDocumentType = 2
	begin
		DECLARE @Non decimal(30, 4),@Number varchar(50),@Message NVARCHAR(MAX)

		select @Non = r.Non,
		       @Number = p.Number
		from VND.PurchaseInvoiceItem i
		join VND.PurchaseInvoice p on i.PurchaseInvoiceID = p.PurchaseInvoiceID
		join VND.PurchaseInvoice_PriceRemains r on i.PurchaseInvoiceItemID = r.PurchaseInvoiceItemID
		where i.PurchaseInvoiceItemID = @BaseDocumentID

		IF (@Non < 0)
		BEGIN
			set @Message = 'مانده تسویه نشده فاکتور خرید شماره {0} منفی خواهد شد.'			
				
			SET @Message= REPLACE(@Message, '{0}', @Number)
			RAISERROR(@Message,16,12)
			return
		END
	end
