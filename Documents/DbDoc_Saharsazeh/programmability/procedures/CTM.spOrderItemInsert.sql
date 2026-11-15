CREATE   PROC [CTM].[spOrderItemInsert] 
    @OrderID INT,
    @RowIndex SMALLINT,
    @StuffID INT,
    @MainQuantity DECIMAL(30, 4),
    @SubQuantity DECIMAL(30, 4),
    @Description NVARCHAR(256),
    @Description2 NVARCHAR(256),
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
		--WITH ENCRYPTION 
AS 
BEGIN
    SET NOCOUNT ON 

    INSERT INTO [CTM].[OrderItem]
      (
        [OrderID],
        [RowIndex],
        [StuffID],
        [MainQuantity],
        [SubQuantity],
        [Description],
        [Description2],
        [Version],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate]
      )
    SELECT @OrderID,
           @RowIndex,
           @StuffID,
           @MainQuantity,
           @SubQuantity,
           @Description,
           @Description2,
           0,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate
	
	-- Begin Return Select <- do not remove
    SELECT  [OrderItemID],
            [Version]     
    FROM   [CTM].[OrderItem]
    WHERE  [OrderItemID] = SCOPE_IDENTITY()
    -- End Return Select <- do not remove
 END
