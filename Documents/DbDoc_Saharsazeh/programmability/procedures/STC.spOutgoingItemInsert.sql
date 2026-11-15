
-------------------------------------
CREATE    PROC [STC].spOutgoingItemInsert
    @OutgoingID INT,
    @RowIndex SMALLINT,
    @JustificationItemID INT,
    @QuotationItemID INT,
    @SaleContractItemID INT,
    @InvoiceItemID INT,
    @RemittanceItemID INT,
    @StuffRequestItemID INT,
    @StuffID INT,
    @MainQuantity DECIMAL(36, 10),
    @SubQuantity DECIMAL(36, 10),
    @Fee DECIMAL(30, 4),
    @Price DECIMAL(30, 4),
    @IsQuantityIncreasable BIT,
    @Description NVARCHAR(250),
    @Description2 NVARCHAR(250),  
    @Creator INT,
    @CreationDate DATETIME,
	@TemporaryOutgoingItemID INT,
	@ReceptionID INT,
	@StuffCompositionID INT,
	@ZoneID INT=NULL

--WITH ENCRYPTION 
	 AS 
SET NOCOUNT ON 

BEGIN TRY
	DECLARE @OutgoingItemID     INT,
	        @StuffTitle         NVARCHAR(250),
	        @Message            NVARCHAR(MAX)
	
	
	SELECT @StuffTitle = Title
	FROM   stf.[Stuff] s
	WHERE  s.StuffID = @StuffID
	
	DECLARE @Type             TINYINT,
	        @date             DATE,
	        @Stock            INT,
	        @DeliverStock     INT
	
	SELECT @Type = sdt.DocumentType,
	       @date             = DATE,
	       @Stock            = StockID,
	       @DeliverStock     = DeliverStockID
	FROM   stc.Outgoing o
	JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
		ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
	       JOIN stc.StockDocumentType sdt
	            ON  sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
	WHERE  OutgoingID        = @OutgoingID
	
	
	IF @Type = 4
	BEGIN
	    IF EXISTS (
	           SELECT o.OutgoingID
	           FROM   stc.Outgoing o
			   JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
					ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
	                  JOIN stc.OutgoingItem oi
	                       ON  o.OutgoingID = oi.OutgoingID
	                  JOIN stc.StockDocumentType sdt
	                       ON  sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
	           WHERE  sdt.DocumentType = 4
	                  AND DATE = @date
	                  AND StockID = @DeliverStock
	                  AND DeliverStockID = @Stock
	                  AND oi.stuffid = @StuffID
	       )
	        RAISERROR(
	            'کالاي %s در همين تاريخ از انبار مقصد به انبار مبدا انتقال داده شده است. جهت تعديل اين انتقال، حواله مورد نظر را حذف يا ويرايش نمائيد.',
	            16,
	            12,
	            @StuffTitle
	        )
	END
	

	if exists (select * from stc.OutgoingItem where OutgoingID = @OutgoingID and RowIndex = @RowIndex )
	begin
	RAISERROR('شماره ردیف تکراری است',16,12)
	end
	
	INSERT INTO [STC].[OutgoingItem]
	  (
	    [OutgoingID],
	    [RowIndex],
	    [JustificationItemID],
	    [QuotationItemID],
	    [InvoiceItemID],
	    [RemittanceItemID],
	    [StuffRequestItemID],
	    [StuffID],
	    [MainQuantity],
	    [SubQuantity],
	    [Fee],
	    [Price],
	    [IsQuantityIncreasable],
	    [Description],
	    [Description2],
		[SaleContractItemID],

	    [Version],
	    [Creator],
	    [CreationDate],
	    [LastEditor],
	    [LastEditionDate],
	    [TemporaryOutgoingItemID],
	    [ReceptionID],
		[StuffCompositionID],
		[ZoneID]
	  )
	SELECT @OutgoingID,
	       @RowIndex,
	       @JustificationItemID,
	       @QuotationItemID,
	       @InvoiceItemID,
	       @RemittanceItemID,
	       @StuffRequestItemID,
	       @StuffID,
	       @MainQuantity,
	       @SubQuantity,
	       @Fee,
	       @Price,
	       @IsQuantityIncreasable,
	       @Description,
	       @Description2,
		   @SaleContractItemID,
	       0,
	       @Creator,
	       @CreationDate,
	       @Creator,
	       @CreationDate,
	       @TemporaryOutgoingItemID,
	       @ReceptionID,
		   @StuffCompositionID,
		   @ZoneID
	
	SET @OutgoingItemID = SCOPE_IDENTITY()
	
	-- Begin Return Select <- do not remove
	SELECT [OutgoingItemID],
	       [OutgoingID],
	       [RowIndex],
	       [JustificationItemID],
	       [QuotationItemID],
	       [InvoiceItemID],
	       [RemittanceItemID],
	       [StuffRequestItemID],
	       [StuffID],
	       [MainQuantity],
	       [SubQuantity],
	       [Fee],
	       [Price],
	       [IsQuantityIncreasable],
	       [Description],
	       [Description2],
	       [Version],
	       [Creator],
	       [CreationDate],
	       [LastEditor],
	       [LastEditionDate],
		   [ZoneID]
	FROM   [STC].[OutgoingItem]
	WHERE  [OutgoingItemID] = SCOPE_IDENTITY()
	       -- End Return Select <- do not remove
END TRY
BEGIN CATCH
	DECLARE @ErrorMessage NVARCHAR(4000);
	DECLARE @ErrorSeverity INT;
	DECLARE @ErrorState INT;
	
	SELECT @ErrorMessage = ERROR_MESSAGE(),
	       @ErrorSeverity     = ERROR_SEVERITY(),
	       @ErrorState        = ERROR_STATE();
	
	RAISERROR (
	    @ErrorMessage,	-- Message text.
	    @ErrorSeverity,	-- Severity.
	    @ErrorState -- State.
	);
END CATCH
