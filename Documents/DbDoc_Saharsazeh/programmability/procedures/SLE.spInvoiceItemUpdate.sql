
CREATE   PROC [SLE].spInvoiceItemUpdate
    @InvoiceItemID INT ,
    @InvoiceID INT ,
    @RowIndex SMALLINT ,
    @SaleModelID SMALLINT ,
    @StuffID INT ,
    @MainQuantity DECIMAL(36, 10) ,
    @SubQuantity DECIMAL(36, 10) ,
    @Fee DECIMAL(36, 10) ,
    @Price DECIMAL(36, 10 ) ,
    @Discount DECIMAL(36, 10) ,
    @Tax DECIMAL(36, 10) ,
    @Duty DECIMAL(36, 10) ,
    @NetPrice DECIMAL(36, 10) ,
    @BaseCurrencyPrice DECIMAL(36, 10 ) ,
    @BaseCurrencyDiscount DECIMAL(36, 10) ,
    @BaseCurrencyTax DECIMAL(36, 10) ,
    @BaseCurrencyDuty DECIMAL(36, 10) ,
    @BaseCurrencyNetPrice DECIMAL(36, 10) ,
    @PricedFromBase BIT ,
    @Description NVARCHAR(250) ,
    @Description2 NVARCHAR(250) ,
    @JustificationItemID INT ,
	@SaleContractItemID INT,
    @QuotationItemID INT ,
    @RemittanceItemID INT ,
    @OutgoingItemId INT ,
    @ContractSubjectID INT ,
    @SaleItemID INT ,
    @Version INT ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @ReceptionID INT ,
    @AllocationSharingAmount DECIMAL(18, 4)
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

        DECLARE @PreviousMainQuantity DECIMAL(30, 4) ,
            @PreviousSubQuantity DECIMAL(30, 4) ,
            @PreviousJustificaion INT ,
            @PreviousQuotation INT ,
            @PreviousRemittance INT ,
            @PreviousOutgoing INT ,
            @PreviousVersion INT ,
            @PreviousRowIndex SMALLINT ,
            @PreviousSaleModelID SMALLINT ,
            @PreviousStuffID INT ,
            @PreviousFee DECIMAL(30, 4) ,
            @PreviousPrice DECIMAL(30, 4) ,
            @PreviousDiscount DECIMAL(30, 4) ,
            @PreviousTax DECIMAL(30, 4) ,
            @PreviousDuty DECIMAL(30, 4) ,
            @PreviousPricedFromBase BIT ,
            @PreviousNetPrice DECIMAL(30, 4) ,
            @PreviousDescription NVARCHAR(250) ,
            @PreviousDescription2 NVARCHAR(250) ,
            @PreviousLastEditor INT ,
            @PreviousLastEditionDate DATETIME ,
            @PreviousReceptionID INT ,
            @PreDate DATE ,
            @PrePrevoucherID INT ,
            @Message NVARCHAR(MAX) ,
            @StuffCode NVARCHAR(256) ,
            @preAllocationSharingAmount DECIMAL(18, 4);
	
        SELECT  @PreDate = [Date] ,
                @PrePrevoucherID = PreVoucherID
        FROM    SLE.Invoice i
        WHERE   i.InvoiceID = @InvoiceID;
	
        
        IF EXISTS ( SELECT 1
                    FROM    CFG.InstallmentPayment
                    WHERE   BaseType = 2
                            AND DocumentID = @InvoiceID )
            BEGIN
                SET @Message = 'InvoiceHasInstallment';
	    
                RAISERROR(@Message, 16, 12);
            END;
	
        SELECT  @PreviousVersion = [Version] ,
                @PreviousMainQuantity = MainQuantity ,
                @PreviousSubQuantity = SubQuantity ,
                @PreviousJustificaion = JustificationItemID ,
                @PreviousQuotation = QuotationItemID ,
                @PreviousRemittance = RemittanceItemID ,
                @PreviousOutgoing = OutgoingItemId ,
                @PreviousRowIndex = RowIndex ,
                @PreviousSaleModelID = SaleModelID ,
                @PreviousStuffID = StuffID ,
                @PreviousFee = Fee ,
                @PreviousPrice = Price ,
                @PreviousDiscount = Discount ,
                @PreviousTax = Tax ,
                @PreviousDuty = Duty ,
                @PreviousPricedFromBase = PricedFromBase ,
                @PreviousNetPrice = NetPrice ,
                @PreviousDescription = [Description] ,
                @PreviousDescription2 = Description2 ,
                @PreviousLastEditor = LastEditor ,
                @PreviousLastEditionDate = LastEditionDate ,
                @PreviousReceptionID = ReceptionID
        FROM    [SLE].[InvoiceItem]
        WHERE   [InvoiceItemID] = @InvoiceItemID;		 
	
        IF @Version <> @PreviousVersion
            OR @PrePrevoucherID IS NOT NULL
            RAISERROR('Version mismatch...', 16, 10);		
	 
	
	-- Start Update		
        IF @RowIndex <> @PreviousRowIndex
            UPDATE  [SLE].[InvoiceItem]
            SET     [RowIndex] = @RowIndex
            WHERE   [InvoiceItemID] = @InvoiceItemID;
	
        IF @SaleModelID <> @PreviousSaleModelID
            UPDATE  [SLE].[InvoiceItem]
            SET     [SaleModelID] = @SaleModelID
            WHERE   [InvoiceItemID] = @InvoiceItemID;
	
        IF @StuffID <> @PreviousStuffID
            UPDATE  [SLE].[InvoiceItem]
            SET     [StuffID] = @StuffID
            WHERE   [InvoiceItemID] = @InvoiceItemID;
	
        IF @MainQuantity <> @PreviousMainQuantity
            BEGIN
                IF ( SELECT SLE.InvoiceItemHasFlow(@InvoiceItemID)
                   ) = 1
                    BEGIN
	        
                        RAISERROR('MainQuantityIsNotEditable', 16, 12);
	        --RAISERROR('به دليل گردش اطلاعات، مجاز به ويرايش مقدار اصلي نيستيد.', 16 , 12)
                    END;
	    
                UPDATE  [SLE].[InvoiceItem]
                SET     [MainQuantity] = @MainQuantity
                WHERE   [InvoiceItemID] = @InvoiceItemID;		
	   
            END;		
	
        IF ISNULL(@SubQuantity, 0) <> ISNULL(@PreviousSubQuantity, 0)
            BEGIN
                IF ( SELECT SLE.InvoiceItemHasFlow(@InvoiceItemID)
                   ) = 1
                    BEGIN	        
                        RAISERROR('SubQuantityIsNotEditable', 16, 12);
	        --RAISERROR('به دليل گردش اطلاعات، مجاز به ويرايش مقدار فرعي نيستيد.', 16 , 12)
                    END;
	    
				IF EXISTS
				(
					SELECT 1
					FROM STF.[StuffDetail] AS s
					WHERE s.StuffID = @StuffID
						  AND s.MeasureSubUnitID IS NULL
				)
					SET @SubQuantity = NULL;

                UPDATE  [SLE].[InvoiceItem]
                SET     [SubQuantity] = @SubQuantity
                WHERE   [InvoiceItemID] = @InvoiceItemID;	   
	    
            END;									
	
        IF @Fee <> @PreviousFee
            UPDATE  [SLE].[InvoiceItem]
            SET     [Fee] = @Fee
            WHERE   [InvoiceItemID] = @InvoiceItemID;				
	
        IF @Price <> @PreviousPrice
            UPDATE  [SLE].[InvoiceItem]
            SET     [Price] = @Price, [BaseCurrencyPrice] = @BaseCurrencyPrice
            WHERE   [InvoiceItemID] = @InvoiceItemID;				
	
        IF @Discount <> @PreviousDiscount
            UPDATE  [SLE].[InvoiceItem]
            SET     [Discount] = @Discount, [BaseCurrencyDiscount] = @BaseCurrencyDiscount
            WHERE   [InvoiceItemID] = @InvoiceItemID;				
	
        IF @Tax <> @PreviousTax
            UPDATE  [SLE].[InvoiceItem]
            SET     [Tax] = @Tax, [BaseCurrencyTax] = @BaseCurrencyTax
            WHERE   [InvoiceItemID] = @InvoiceItemID;				
	
        IF @Duty <> @PreviousDuty
            UPDATE  [SLE].[InvoiceItem]
            SET     [Duty] = @Duty, [BaseCurrencyDuty] = @BaseCurrencyDuty
            WHERE   [InvoiceItemID] = @InvoiceItemID;
        
        IF @PricedFromBase <> @PreviousPricedFromBase
            UPDATE  [SLE].[InvoiceItem]
            SET     [PricedFromBase] = @PricedFromBase
            WHERE   [InvoiceItemID] = @InvoiceItemID;
	
        --IF @NetPrice <> @PreviousNetPrice
        --    BEGIN
        --        IF ( SELECT SLE.InvoiceHasFlow(@InvoiceID)
        --           ) = 1
        --            BEGIN
        --                RAISERROR('PricesAreNotEditable', 16, 12);
	       -- --RAISERROR('به دليل گردش اطلاعات، مجاز به ويرايش مبالغ نيستيد.', 16 , 12)
        --            END;
	    
        --        UPDATE  [SLE].[InvoiceItem]
        --        SET     [NetPrice] = @NetPrice
        --        WHERE   [InvoiceItemID] = @InvoiceItemID;
        --    END;	
	
        IF ISNULL(@Description, '') <> ISNULL(@PreviousDescription, '')
            UPDATE  [SLE].[InvoiceItem]
            SET     [Description] = @Description
            WHERE   [InvoiceItemID] = @InvoiceItemID;						
	
        IF ISNULL(@Description2, '') <> ISNULL(@PreviousDescription2, '')
            UPDATE  [SLE].[InvoiceItem]
            SET     [Description2] = @Description2
            WHERE   [InvoiceItemID] = @InvoiceItemID;					
	
        IF ISNULL(@JustificationItemID, 0) <> ISNULL(@PreviousJustificaion, 0)
            UPDATE  [SLE].[InvoiceItem]
            SET     [JustificationItemID] = @JustificationItemID
            WHERE   [InvoiceItemID] = @InvoiceItemID;			
	
        IF ISNULL(@QuotationItemID, 0) <> ISNULL(@PreviousQuotation, 0)
            UPDATE  [SLE].[InvoiceItem]
            SET     [QuotationItemID] = @QuotationItemID
            WHERE   [InvoiceItemID] = @InvoiceItemID;			
	
        IF ISNULL(@RemittanceItemID, 0) <> ISNULL(@PreviousRemittance, 0)
            UPDATE  [SLE].[InvoiceItem]
            SET     [RemittanceItemID] = @RemittanceItemID
            WHERE   [InvoiceItemID] = @InvoiceItemID;		
	
        IF ISNULL(@OutgoingItemId, 0) <> ISNULL(@PreviousOutgoing, 0)
            UPDATE  [SLE].[InvoiceItem]
            SET     [OutgoingItemId] = @OutgoingItemId
            WHERE   [InvoiceItemID] = @InvoiceItemID;			
	
        IF ISNULL(@ReceptionID, 0) <> ISNULL(@PreviousReceptionID, 0)
            UPDATE  [SLE].[InvoiceItem]
            SET     [ReceptionID] = @ReceptionID
            WHERE   [InvoiceItemID] = @InvoiceItemID;			
	
        UPDATE  [SLE].[InvoiceItem]
        SET     [Version] = [Version] + 1 ,
                [ContractSubjectID] = @ContractSubjectID ,
                [SaleItemID] = @SaleItemID,
				SaleContractItemID =@SaleContractItemID
        WHERE   [InvoiceItemID] = @InvoiceItemID;	
	
        IF @LastEditor <> @PreviousLastEditor
            UPDATE  [SLE].[InvoiceItem]
            SET     [LastEditor] = @LastEditor
            WHERE   [InvoiceItemID] = @InvoiceItemID;				
	
        IF @LastEditionDate <> @PreviousLastEditionDate
            UPDATE  [SLE].[InvoiceItem]
            SET     [LastEditionDate] = @LastEditionDate
            WHERE   [InvoiceItemID] = @InvoiceItemID; 

        UPDATE  [SLE].[InvoiceItem]
        SET     AllocationSharingAmount = @AllocationSharingAmount
        WHERE   [InvoiceItemID] = @InvoiceItemID; 

	-- End Update			
	

	if exists (
	select DoMainQuantity from sle.Outgoing_Non_Invoice
	where OutgoingItemID = @OutgoingItemId
	and DoMainQuantity > MainQuantity
	) 
	begin
	raiserror(N'مانده فاکتور نشده حواله نمی تواند منفی باشد',16,12)
	end



	-- Begin Return Select <- do not remove
        SELECT   [Version] 
        FROM    [SLE].[InvoiceItem]
        WHERE   [InvoiceItemID] = @InvoiceItemID; 
	       -- End Return Select <- do not remove


