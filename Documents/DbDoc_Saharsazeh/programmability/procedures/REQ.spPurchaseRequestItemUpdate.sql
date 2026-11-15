CREATE   PROC [REQ].[spPurchaseRequestItemUpdate]
    @PurchaseRequestItemID INT ,
    @PurchaseRequestID INT ,
    @PurchaseRequestItemIndex INT ,
    @StuffRequestItemID INT ,
    @StuffID INT ,
    @MainQuantity DECIMAL(30, 4) ,
    @SubQuantity DECIMAL(30, 4) ,
    @Description NVARCHAR(256) ,
    @Description2 NVARCHAR(256) ,
    @AcceptRequestMainMeasureQuantity DECIMAL(30, 4) ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @Version INT ,
    @AcceptRequestSubMeasureQuantity DECIMAL(30, 4) ,
    @OrderItemID INT ,
    @JustificationItemID INT ,
    @QuotationItemID INT ,
    @SaleContractItemID INT,
    @ServiceRequestItemID INT
--WITH ENCRYPTION
AS
BEGIN
    SET NOCOUNT ON;

        DECLARE @StuffCode NVARCHAR(256) ,
                @PreMainQuantity DECIMAL(30, 4) ,
                @PreSubQuantity DECIMAL(30, 4) ,
                @PreVersion INT ,
                @PreStuffRequestItemID INT ,
                @Message NVARCHAR(MAX);

        SELECT @PreVersion = [Version] ,
               @PreMainQuantity = MainQuantity ,
               @PreSubQuantity = SubQuantity ,
               @PreStuffRequestItemID = StuffRequestItemID
        FROM   [REQ].[PurchaseRequestItem]
        WHERE  [PurchaseRequestItemID] = @PurchaseRequestItemID;

        IF @Version <> @PreVersion
            RAISERROR('Version mismatch...', 16, 10);

        IF ( @MainQuantity <> @PreMainQuantity )
            BEGIN
                IF ( SELECT REQ.PurchaseRequestItemHasFlow(
                                @PurchaseRequestItemID)) = 1
                BEGIN
                    SELECT @Message = 'MainQuantityIsNotEditable'
                       
                    RAISERROR(@Message, 16, 12);
                END;

                UPDATE [REQ].[PurchaseRequestItem]
                SET    [MainQuantity] = @MainQuantity
                WHERE  [PurchaseRequestItemID] = @PurchaseRequestItemID;
            END;

        IF ISNULL(@SubQuantity, 0) <> ISNULL(@PreSubQuantity, 0)
            BEGIN

                IF ( SELECT REQ.PurchaseRequestItemHasFlow(
                                @PurchaseRequestItemID)) = 1
                    BEGIN
                        SELECT @Message =  'SubQuantityIsNotEditable'
                        RAISERROR(@Message, 16, 12);
                    END;

                UPDATE [REQ].[PurchaseRequestItem]
                SET    [SubQuantity] = @SubQuantity
                WHERE  [PurchaseRequestItemID] = @PurchaseRequestItemID;

            END;

        UPDATE [REQ].[PurchaseRequestItem]
        SET    [PurchaseRequestItemIndex] = @PurchaseRequestItemIndex ,
               [StuffRequestItemID] = @StuffRequestItemID ,
               [StuffID] = @StuffID ,
               [Description] = @Description ,
               [Description2] = @Description2 ,
               [LastEditor] = @LastEditor ,
               [LastEditionDate] = @LastEditionDate ,
               [Version] = @Version + 1 ,
               [AcceptRequestMainMeasureQuantity] = @AcceptRequestMainMeasureQuantity ,
               [AcceptRequestSubMeasureQuantity] = @AcceptRequestSubMeasureQuantity,
			   [OrderItemID] = @OrderItemID,
			   [JustificationItemID]=@JustificationItemID,
			   [QuotationItemID]= @QuotationItemID,
			   [SaleContractItemID] = @SaleContractItemID,
               [ServiceRequestItemID] = @ServiceRequestItemID
        WHERE  [PurchaseRequestItemID] = @PurchaseRequestItemID;

        -- Begin Return Select <- do not remove
        SELECT  [Version] 
        FROM   [REQ].[PurchaseRequestItem]
        WHERE  [PurchaseRequestItemID] = @PurchaseRequestItemID;
    -- End Return Select <- do not remove
END
