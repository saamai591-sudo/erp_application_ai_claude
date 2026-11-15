CREATE   PROC [STC].[spInventoryEditionItemTraceUpdate] 
    @InventoryEditionItemTraceID int,
    @InventoryEditionItemID int,
    @TraceID int,
    @DlID bigint = NULL,
    @Value nvarchar(MAX) = NULL,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @TraceItemID int = NULL
AS 
	SET NOCOUNT ON 
	
    IF @Version = (   SELECT [Version]
                      FROM   [STC].[InventoryEditionItemTrace]
                      WHERE  [InventoryEditionItemTraceID] = @InventoryEditionItemTraceID )
        BEGIN

            SET @Version = @Version + 1;

		UPDATE [STC].[InventoryEditionItemTrace]
		SET    [InventoryEditionItemID] = @InventoryEditionItemID, [TraceID] = @TraceID, [DlID] = @DlID, [Value] = @Value, [Version] = @Version, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate, [TraceItemID] = @TraceItemID
		WHERE  [InventoryEditionItemTraceID] = @InventoryEditionItemTraceID 
	
		-- Begin Return Select <- do not remove
		SELECT [InventoryEditionItemTraceID], [InventoryEditionItemID], [TraceID], [DlID], [Value], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [TraceItemID]
		FROM   [STC].[InventoryEditionItemTrace]
		WHERE  [InventoryEditionItemTraceID] = @InventoryEditionItemTraceID 	
		-- End Return Select <- do not remove

	END
