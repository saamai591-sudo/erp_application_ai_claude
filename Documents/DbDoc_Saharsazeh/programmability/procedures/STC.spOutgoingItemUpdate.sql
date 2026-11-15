-------------------------------------
CREATE    PROC [STC].spOutgoingItemUpdate
    @OutgoingItemID INT ,
    @OutgoingID INT ,
    @RowIndex SMALLINT ,
    @JustificationItemID INT ,
    @QuotationItemID INT ,
    @InvoiceItemID INT ,
    @RemittanceItemID INT ,
    @StuffRequestItemID INT ,
    @SaleContractItemID INT ,
    @StuffID INT ,
    @MainQuantity DECIMAL(36, 10) ,
    @SubQuantity DECIMAL(36, 10) ,
    @Fee DECIMAL(30, 4) ,
    @Price DECIMAL(30, 4) ,
    @IsQuantityIncreasable BIT ,
    @Description NVARCHAR(250) ,
    @Description2 NVARCHAR(250) ,
    @Version INT ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @TemporaryOutgoingItemID INT ,
    @ReceptionID INT,
	@StuffCompositionID INT,
    @ZoneID INT =NULL

--WITH ENCRYPTION 
AS
    SET NOCOUNT ON; 
	
        DECLARE @PreMainQuantity DECIMAL(30, 4) ,
            @PreSubQuantity DECIMAL(30, 4) ,
            @StuffTitle NVARCHAR(250) ,
            @PreVersion INT ,
            @preJustification INT ,
            @preAmountReceiptItemID INT ,
            @preTemporaryOutgoingItemID INT ,
            @preQuotation INT ,
            @preInvoice INT ,
            @preRemittance INT ,
            @preStuffRequest INT ,
            @PrePrevoucherid INT ,
            @Message NVARCHAR(MAX) ,
            @Type TINYINT ,
            @date DATE ,
            @Stock INT ,
            @DeliverStock INT;
	
	
        SELECT  @PreVersion = oi.[Version] ,
                @preJustification = JustificationItemID ,
                @preQuotation = QuotationItemID ,
                @preInvoice = InvoiceItemID ,
                @preRemittance = RemittanceItemID ,
                @preStuffRequest = StuffRequestItemID ,
                @PreMainQuantity = MainQuantity ,
                @PreSubQuantity = SubQuantity ,
                @PrePrevoucherid = o.PreVoucherID ,
                @preTemporaryOutgoingItemID = TemporaryOutgoingItemID ,
                @Type = sdt.DocumentType ,
                @date = Date ,
                @Stock = StockID ,
                @DeliverStock = DeliverStockID
        FROM    [STC].[OutgoingItem] oi
                JOIN STC.Outgoing o ON o.OutgoingID = oi.OutgoingID
                JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
        WHERE   [OutgoingItemID] = @OutgoingItemID;
	
        IF @Version <> @PreVersion
            OR @PrePrevoucherid IS NOT NULL
            RAISERROR('Version mismatch...', 16, 10);	
	
	
        SELECT  @StuffTitle = Title
        FROM    STF.[Stuff] s
        WHERE   s.StuffID = @StuffID;
	
        IF @Type = 4
            BEGIN
                IF EXISTS ( SELECT  o.OutgoingID
                            FROM    STC.Outgoing o
                            JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                                    JOIN STC.OutgoingItem oi ON o.OutgoingID = oi.OutgoingID
                                    JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
                            WHERE   sdt.DocumentType = 4
                                    AND Date = @date
                                    AND StockID = @DeliverStock
                                    AND DeliverStockID = @Stock
                                    AND oi.StuffID = @StuffID )
                    RAISERROR(
	            'کالاي %s در همين تاريخ از انبار مقصد به انبار مبدا انتقال داده شده است. جهت تعديل اين انتقال، حواله مورد نظر را حذف يا ويرايش نمائيد.',
	            16,
	            12,
	            @StuffTitle
	        );
            END;

	
	--**پاک کردن تاثير روي آيتمهاي مبنا قبل از اعمال بروزرساني
	
	
        IF ( @MainQuantity <> @PreMainQuantity )
            BEGIN
                IF ( SELECT STC.OutgoingItemHasFlow(@OutgoingItemID)
                   ) = 1
                    BEGIN
                        SELECT  @Message = 'MainQuantityIsNotEditable'
                      
	        
                        RAISERROR(@Message, 16, 12);
	        --RAISERROR('به دليل گردش اطلاعات، مجاز به ويرايش مقدار اصلي نيستيد.', 16 , 12)
                    END;		
	    
                UPDATE  [STC].[OutgoingItem]
                SET     [MainQuantity] = @MainQuantity
                WHERE   [OutgoingItemID] = @OutgoingItemID;
            END;
	
        IF ( ISNULL(@SubQuantity, 0) <> ISNULL(@PreSubQuantity, 0) )
            BEGIN
                IF ( SELECT STC.OutgoingItemHasFlow(@OutgoingItemID)
                   ) = 1
                    BEGIN
                        SELECT  @Message =  'SubQuantityIsNotEditable'
                        
	        
                        RAISERROR(@Message, 16, 12); 
	        --RAISERROR('به دليل گردش اطلاعات، مجاز به ويرايش مقدار فرعي نيستيد.', 16 , 12)
                    END;
	    
	    
                UPDATE  [STC].[OutgoingItem]
                SET     [SubQuantity] = @SubQuantity
                WHERE   [OutgoingItemID] = @OutgoingItemID;
            END;
	
        UPDATE  [STC].[OutgoingItem]
        SET     [RowIndex] = @RowIndex ,
                [JustificationItemID] = @JustificationItemID ,
                [QuotationItemID] = @QuotationItemID ,
                [InvoiceItemID] = @InvoiceItemID ,
                [RemittanceItemID] = @RemittanceItemID ,
                [StuffRequestItemID] = @StuffRequestItemID ,
                [StuffID] = @StuffID ,
                [Fee] = @Fee ,
                [Price] = @Price ,
                [IsQuantityIncreasable] = @IsQuantityIncreasable ,
                [Description] = @Description ,
                [Description2] = @Description2 ,
                [Version] = @Version + 1 ,
                [LastEditor] = @LastEditor ,
                [LastEditionDate] = @LastEditionDate ,
                [TemporaryOutgoingItemID] = @TemporaryOutgoingItemID ,
                [ReceptionID] = @ReceptionID ,
                [SaleContractItemID] = @SaleContractItemID,
				[StuffCompositionID] = @StuffCompositionID,
                [ZoneID]=@ZoneID
        WHERE   [OutgoingItemID] = @OutgoingItemID;
	

	-- Begin Return Select <- do not remove
        SELECT   [Version] 
        FROM    [STC].[OutgoingItem]
        WHERE   [OutgoingItemID] = @OutgoingItemID; 
	       -- End Return Select <- do not remove
