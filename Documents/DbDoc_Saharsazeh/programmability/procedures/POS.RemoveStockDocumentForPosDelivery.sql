-------------------------------------
CREATE   PROC pos.RemoveStockDocumentForPosDelivery
(
	@DeliveryId INT
)
--WITH ENCRYPTION 
AS
BEGIN
	
	DECLARE @FinalStuffInventoryErrors NVARCHAR(MAX),@FinalStuffInventoryErrors2 NVARCHAR(MAX)
	set @FinalStuffInventoryErrors = cfg.getTempTableName(1)
	set @FinalStuffInventoryErrors2 = cfg.getTempTableName(1)
	
    CREATE TABLE  #error  (
    [Message] NVARCHAR(MAX) ,
    IsDetail BIT )

	DECLARE @OutgoingID INT 
	DECLARE @ReturnedOutgoingID INT
	DECLARE @PrevoucherID INT

	SELECT  @OutgoingID = OutgoingID,
			@ReturnedOutgoingID = ReturnedOutgoingID,
			@PrevoucherID = PreVoucherID
	FROM  pos.Delivery
	WHERE DeliveryID = @DeliveryId

	DECLARE  @ErrorMessage NVARCHAR(4000)
			,@ErrorSeverity INT
			,@ErrorState INT;

	IF @PrevoucherID IS NOT NULL
	BEGIN
		SET @ErrorMessage = N'Messages.OperationFailedBecauseOfIssueVoucher'
		INSERT INTO #error values(@ErrorMessage,0);
				
		SELECT * FROM #error
		RETURN;
	END

	IF EXISTS(SELECT 1 FROM STC.Outgoing WHERE OutgoingID = @OutgoingID AND PreVoucherID IS NOT NULL) OR
	 EXISTS(SELECT 1 FROM STC.ReturnedOutgoing WHERE ReturnedOutgoingID = @ReturnedOutgoingID AND PreVoucherID IS NOT NULL) 
	 BEGIN
 		SET @ErrorMessage = N'Messages.OperationFailedBecauseOfIssueVoucher'
		INSERT INTO #error values(@ErrorMessage,0);
				
		SELECT * FROM #error
		RETURN;
	 END 

	IF EXISTS (SELECT 1 FROM STC.Outgoing rsr	
				WHERE OutgoingID = @OutgoingID)					
	BEGIN


			EXEC [STC].[SpFinalStuffInventory]  
					@ID = NUll,
					@EntityName = 'Outgoing',
					@Confirmed = 2,
					@IsDeleteOperation = 1,
					@HeaderIDs = @OutgoingID,
					@ControlType = 3,
					@RecountingInvetoryID = NULL,
					@InventoryEditionID = NULL,	
					@ErrorTable = @FinalStuffInventoryErrors
					
			EXEC (N'insert into #error select * from '+@FinalStuffInventoryErrors)		
					
			IF EXISTS(SELECT 1 FROM #error)
			BEGIN
				SELECT * FROM #error
				RETURN 
			END 

			UPDATE pos.Delivery
			SET OutgoingID = NULL
			WHERE DeliveryID = @DeliveryId

			DELETE STC.Outgoing	
			WHERE OutgoingID = @OutgoingID

	
	END

	IF EXISTS (SELECT 1 FROM STC.ReturnedOutgoing rsr WHERE ReturnedOutgoingID = @ReturnedOutgoingID)		
	BEGIN	
	
			EXEC [STC].[SpFinalStuffInventory]  
				@ID = Null,
				@EntityName = 'ReturnedOutgoing',
				@Confirmed = 2,
				@IsDeleteOperation = 1,
				@HeaderIDs = @ReturnedOutgoingID,
				@ControlType = 3,
				@RecountingInvetoryID = NULL,
				@InventoryEditionID = NULL,	
					@ErrorTable = @FinalStuffInventoryErrors2

					
				EXEC (N'insert into #error select * from '+@FinalStuffInventoryErrors2)			

			IF EXISTS(SELECT 1 FROM #error)
			BEGIN
				SELECT * FROM #error
				RETURN 
			END 

			UPDATE pos.Delivery
			SET	ReturnedOutgoingID = null
			WHERE DeliveryID = @DeliveryId

			DELETE STC.ReturnedOutgoing	
			WHERE ReturnedOutgoingID = @ReturnedOutgoingID

		
	END

	DECLARE @LastEditor INT = [CFG].[GetuserID]()
	DECLARE @LastEditionDate DATETIME = GETDATE()

	UPDATE pos.Delivery
	SET [Status]  = 1,
				LastEditor=@LastEditor,
				LastEditionDate=@LastEditionDate
	WHERE DeliveryID = @DeliveryId

	UPDATE pi 
	SET  deliverd = 0
	FROM pos.PosInvoice pi
		JOIN pos.DeliveryPosInvoice dpi 
			ON pi.PosInvoiceID = dpi.PosInvoiceID
	WHERE dpi.DeliveryID = @DeliveryId
	SELECT * FROM #error
END
