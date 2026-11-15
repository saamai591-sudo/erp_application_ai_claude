CREATE   PROC [CTM].[spShoppingCartUpdate] 
    @ShoppingCartID int,
    @FromSerialNumber int,
    @ToSerialNumber int,
    @Amount decimal(30, 4),
    @SlID int,
    @IssueDate date,
    @ExpireDate date,
    @Description nvarchar(MAX),
    @LastEditionDate datetime,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int
AS
BEGIN
	SET NOCOUNT ON 

	if @Version=(Select [Version] from [CTM].[ShoppingCart]
	where [ShoppingCartID] = @ShoppingCartID)
	begin	
		EXEC CTM.CheckShoppingCard @shoppingCartID,@FromSerialNumber,@ToSerialNumber,@IssueDate,@ExpireDate
	
		set @Version = @Version +1 

		UPDATE [CTM].[ShoppingCart]
		SET    [FromSerialNumber] = @FromSerialNumber, [ToSerialNumber] = @ToSerialNumber, [Amount] = @Amount, [SlID] = @SlID, [IssueDate] = @IssueDate, [ExpireDate] = @ExpireDate, [Description] = @Description, [LastEditionDate] = @LastEditionDate, [Version] = @Version, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor
		WHERE  [ShoppingCartID] = @ShoppingCartID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version]
		FROM   [CTM].[ShoppingCart]
		WHERE  [ShoppingCartID] = @ShoppingCartID	
		-- End Return Select <- do not remove
	end 
	ELSE 
			RAISERROR('Version mismatch...', 16 , 10)	
END
