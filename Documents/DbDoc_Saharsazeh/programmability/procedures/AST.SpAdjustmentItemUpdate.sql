CREATE   PROC [AST].[SpAdjustmentItemUpdate]
    @AdjustmentItemID int,
    @AdjustmentID int,
    @AssetID int,
	@BaseDocumentType Tinyint,
	@BaseDocumentID int,
    @Amount decimal(30, 4),
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
SET NOCOUNT ON 
	if @Version <> (Select [Version] from [AST].[AdjustmentItem]
				where [AdjustmentItemID] = @AdjustmentItemID)
		begin
			RAISERROR('Version mismatch...', 16 , 10)
			return
	    end
	
	
	DECLARE @PreAssetID int,			
			@FinancialPeriod int,
			@PrePlaque varchar(50) = null,
			@Plaque varchar(50) = null,
			@Date date

	SELECT @FinancialPeriod = adj.FinancialPeriodID,
	       @Date = adj.Date,
	       @PreAssetID = a.AssetID,
		   @PrePlaque = s.Plaque		   
	FROM AST.AdjustmentItem a
	join AST.Adjustment adj on a.AdjustmentID = adj.AdjustmentID
	join AST.Asset s on a.AssetID = s.AssetID
	WHERE a.AdjustmentItemID = @AdjustmentItemID


	if exists (select 1 from AST.Depreciation d
	           join AST.AssetSetting ass on d.AssetSettingID = ass.AssetSettingID
				where ass.AssetID = @PreAssetID and d.Date >= @Date
			  )
		begin
			raiserror('برای پلاک دارایی (%s) به تاریخ بزرگتر مساوی تاریخ تغییر بها، محاسبه استهلاک انجام شده است. بنابراین امکان ویرایش اطلاعات وجود ندارد.',16,12,@PrePlaque)
			return
		end

	if (@AssetID <> @PreAssetID)
	begin

		select @Plaque = Plaque from AST.Asset where AssetID = @AssetID

		if exists (select 1 from AST.Depreciation d
	           join AST.AssetSetting ass on d.AssetSettingID = ass.AssetSettingID
				where ass.AssetID = @AssetID and d.Date >= @Date
			  )
		begin
			raiserror('برای پلاک دارایی (%s) به تاریخ بزرگتر مساوی تاریخ وارد شده، محاسبه استهلاک انجام شده است. بنابراین نمی توان برای این دارایی تغییر بها صادر نمود.',16,12,@Plaque)
			return
		end
	end

	set @Version = @Version +1 

		UPDATE [AST].[AdjustmentItem]
		SET    [AdjustmentID] = @AdjustmentID, 
			   [AssetID] = @AssetID,
			   BaseDocumentType = @BaseDocumentType,
		       BaseDocumentID = @BaseDocumentID,
			   [Amount] = @Amount, [Version] = @Version, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate
		WHERE  [AdjustmentItemID] = @AdjustmentItemID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version]
		FROM   [AST].[AdjustmentItem]
		WHERE  [AdjustmentItemID] = @AdjustmentItemID	
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
