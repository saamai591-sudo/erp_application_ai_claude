CREATE   PROC [CTM].[spOrderItemUpdate] 
    @OrderItemID INT,
    @OrderID INT,
    @RowIndex SMALLINT,
    @StuffID INT,
    @MainQuantity DECIMAL(30, 4),
    @SubQuantity DECIMAL(30, 4),
    @Description NVARCHAR(256),
    @Description2 NVARCHAR(256),
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION 
AS 
BEGIN
	SET NOCOUNT ON 
	DECLARE @PreviousMainQuantity     DECIMAL(30, 4),
	        @PreviousSubQuantity      DECIMAL(30, 4),
	        @PreVersion               INT
	
	SELECT @PreVersion = [Version],
	       @PreviousMainQuantity     = MainQuantity,
	       @PreviousSubQuantity      = SubQuantity
	FROM   [CTM].[OrderItem]
	WHERE  [OrderItemID]             = @OrderItemID
	
	IF @Version <> @PreVersion
	    RAISERROR('Version mismatch...', 16, 10)
	
	IF (@MainQuantity <> @PreviousMainQuantity)
	BEGIN
	    IF (
	           SELECT ctm.OrderItemHasFlow(@OrderItemID)
	       ) = 1
	    BEGIN
	        DECLARE @Message NVARCHAR(MAX)
	        SELECT @Message ='MainQuantityIsNotEditable'
	        RAISERROR(@Message, 16, 12)
	    END
	    
	    UPDATE [CTM].[OrderItem]
	    SET    [MainQuantity]     = @MainQuantity
	    WHERE  [OrderItemID]      = @OrderItemID
	END
	
	IF ISNULL(@SubQuantity, 0) <> ISNULL(@PreviousSubQuantity, 0)
	BEGIN
	    IF (
	           SELECT ctm.OrderItemHasFlow(@OrderItemID)
	       ) = 1
	    BEGIN
	        SELECT @Message = 'SubQuantityIsNotEditable'
	        RAISERROR(@Message, 16, 12)
	    END
	    
	    UPDATE [CTM].[OrderItem]
	    SET    [SubQuantity] = @SubQuantity
	    WHERE  [OrderItemID] = @OrderItemID
	END
	
	UPDATE [CTM].[OrderItem]
	SET    [RowIndex] = @RowIndex,
	       [StuffID] = @StuffID,
	       [Description] = @Description,
	       [Description2] = @Description2,
	       [Version] = @Version + 1,
	       [LastEditor] = @LastEditor,
	       [LastEditionDate] = @LastEditionDate
	WHERE  [OrderItemID] = @OrderItemID
	
	-- Begin Return Select <- do not remove
	SELECT  [Version]
	FROM   [CTM].[OrderItem]
	WHERE  [OrderItemID] = @OrderItemID 
	-- End Return Select <- do not remove
END
