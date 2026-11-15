
-------------------------------------
CREATE    PROC [FOS].[spProformaInvoiceItemUpdate]
    @ProformaInvoiceItemID INT ,
    @ProformaInvoiceID INT ,
    @RowIndex SMALLINT ,
    @PurchaseRequestItemID INT ,
    @ProposalItemID INT ,
    @PurchaseContractItemID INT ,
    @StuffID INT ,
    @MainQuantity DECIMAL(30, 4) ,
    @SubQuantity DECIMAL(30, 4) ,
    @Fee DECIMAL(36, 10) ,
    @Price DECIMAL(30, 4) ,
    @Description NVARCHAR(256) ,
    @Description2 NVARCHAR(256) ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @Version INT
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

    IF @Version = (   SELECT [Version]
                        FROM   [FOS].[ProformaInvoiceItem]
                        WHERE  [ProformaInvoiceItemID] = @ProformaInvoiceItemID )
        BEGIN

            SET @Version = @Version + 1;

            UPDATE [FOS].[ProformaInvoiceItem]
            SET    [ProformaInvoiceID] = @ProformaInvoiceID ,
                    [RowIndex] = @RowIndex ,
                    [PurchaseRequestItemID] = @PurchaseRequestItemID ,
                    [ProposalItemID] = @ProposalItemID ,
                    [PurchaseContractItemID] = @PurchaseContractItemID ,
                    [StuffID] = @StuffID ,
                    [MainQuantity] = @MainQuantity ,
                    [SubQuantity] = @SubQuantity ,
                    [Fee] = @Fee ,
                    [Price] = @Price ,
                    [Description] = @Description ,
                    [Description2] = @Description2 ,
                    [LastEditor] = @LastEditor ,
                    [LastEditionDate] = @LastEditionDate ,
                    [Version] = @Version
            WHERE  [ProformaInvoiceItemID] = @ProformaInvoiceItemID;

            DECLARE @Number VARCHAR(50) = NULL ,
                    @MainRemain DECIMAL(30, 4) = NULL ,
                    @SubRemain DECIMAL(30, 4) = NULL ,
                    @Message NVARCHAR(MAX) ,
                    @userName NVARCHAR(500);

            IF @LastEditor <> -1
                BEGIN

                SELECT  vola.UserID,
                        vola.EntityName,
                        vola.AccessKey 
                        INTO #formAccess
                FROM CFG.vwOperationLevelAccess AS vola
                WHERE vola.EntityName = 'ProformaInvoice' 
                AND vola.UserID = @LastEditor 


                        IF ( @PurchaseRequestItemID IS NOT NULL
                               AND NOT EXISTS (  
                                SELECT 1 FROM #formAccess vola
                                WHERE vola.AccessKey ='ProformaInvoicePurchaseRequestBaseIncreaseQuantity'))
                            BEGIN
                                SELECT @MainRemain = r.Non ,
                                       @SubRemain = r.NonSub ,
                                       @Number = p.PurchaseRequestNumber
                                FROM   REQ.PurchaseRequestItem i
                                       JOIN REQ.PurchaseRequest p ON i.PurchaseRequestID = p.PurchaseRequestID
                                       JOIN REQ.[PurchaseRequest_Remains] r ON i.PurchaseRequestItemID = r.PurchaseRequestItemID
                                WHERE  r.PurchaseRequestItemID = @PurchaseRequestItemID;

                            IF ( @MainRemain < 0 )
                                BEGIN
                                    SELECT @Message = 'مانده اصلی در خواست خرید شماره {0} منفی خواهد شد.';
                                    SET @Message = REPLACE(
                                                        @Message ,
                                                        '{0}' ,
                                                        @Number);
                                    RAISERROR(@Message, 16, 12);
                                    RETURN;
                                END;

                            IF ( @SubRemain < 0 )
                                BEGIN
                                    SELECT @Message = 'مانده فرعی در خواست خرید شماره {0} منفی خواهد شد.';
                                    SET @Message = REPLACE(
                                                        @Message ,
                                                        '{0}' ,
                                                        @Number);
                                    RAISERROR(@Message, 16, 12);
                                    RETURN;
                                END;
                        END;

                    IF (   @ProposalItemID IS NOT NULL
                            AND NOT EXISTS (   SELECT 1
                                                FROM   #formAccess AS fa
                                                WHERE  fa.AccessKey = 'ProformaInvoiceProposalBaseIncreaseQuantity' ))
                        BEGIN
                            SELECT @MainRemain = r.MainRemain ,
                                    @SubRemain = r.SubRemain ,
                                    @Number = p.Number
                            FROM   VND.ProposalItem i
                                    JOIN VND.Proposal p ON i.ProposalID = p.ProposalID
                                    JOIN VND.ProposalItem_NotImplementedRemain r ON i.ProposalItemID = r.ProposalItemID
                            WHERE  r.ProposalItemID = @ProposalItemID;

                            IF ( @MainRemain < 0 )
                                BEGIN
                                    SELECT @Message = 'مانده اصلی استعلام قیمت شماره {0} منفی خواهد شد.';
                                    SET @Message = REPLACE(
                                                        @Message ,
                                                        '{0}' ,
                                                        @Number);
                                    RAISERROR(@Message, 16, 12);
                                    RETURN;
                                END;

                            IF ( @SubRemain < 0 )
                                BEGIN
                                    SELECT @Message = 'مانده فرعی استعلام قیمت شماره {0} منفی خواهد شد.';
                                    SET @Message = REPLACE(
                                                        @Message ,
                                                        '{0}' ,
                                                        @Number);
                                    RAISERROR(@Message, 16, 12);
                                    RETURN;
                                END;
                        END;

                    IF (   @PurchaseContractItemID IS NOT NULL
                            AND NOT EXISTS (   SELECT 1
                                                FROM   #formAccess AS fa
                                                WHERE  fa.AccessKey = 'ProformaInvoicePurchaseContractBaseIncreaseQuantity' ))
                        BEGIN
                            SELECT @MainRemain = r.Non ,
                                    @SubRemain = r.NonSub ,
                                    @Number = p.Number
                            FROM   VND.PurchaseContractItem i
                                    JOIN VND.PurchaseContract p ON i.PurchaseContractID = p.PurchaseContractID
                                    JOIN VND.PurchaseContract_Remains r ON i.PurchaseContractItemID = r.PurchaseContractItemID
                            WHERE  r.PurchaseContractItemID = @PurchaseContractItemID;

                            IF ( @MainRemain < 0 )
                                BEGIN
                                   SET @Message = 'ForeignOrder.Messages.OriginalRemainOfPurchaseOrderWillBecomeNegative^' + CAST(@Number AS NVARCHAR(10));
                                    RAISERROR(@Message, 16, 12);
                                    RETURN;
                                END;

                            IF ( @SubRemain < 0 )
                                BEGIN
                                    SET @Message = 'ForeignOrder.Messages.SubRemainOfPurchaseOrderWillBecomeNegative^' + CAST(@Number AS NVARCHAR(10));
                                    RAISERROR(@Message, 16, 12);
                                    RETURN;
                                END;
                        END;
                END;

            -- Begin Return Select <- do not remove
            SELECT [Version]
            FROM   [FOS].[ProformaInvoiceItem]
            WHERE  [ProformaInvoiceItemID] = @ProformaInvoiceItemID;
            -- End Return Select <- do not remove

        END;
    ELSE
        RAISERROR('Version mismatch...', 16, 10);
