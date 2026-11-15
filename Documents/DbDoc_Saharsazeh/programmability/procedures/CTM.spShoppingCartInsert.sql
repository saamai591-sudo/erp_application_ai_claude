CREATE   PROC [CTM].[spShoppingCartInsert] 
    @FromSerialNumber int,
    @ToSerialNumber int,
    @Amount decimal(30, 4),
    @SlID int,
    @IssueDate date,
    @ExpireDate date,
    @Description nvarchar(MAX),
    @LastEditionDate datetime,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int
AS 
BEGIN
	SET NOCOUNT ON 

	EXEC CTM.CheckShoppingCard 0,@FromSerialNumber,@ToSerialNumber,@IssueDate,@ExpireDate
	 
	INSERT INTO [CTM].[ShoppingCart] ([FromSerialNumber], [ToSerialNumber], [Amount], [SlID], [IssueDate], [ExpireDate], [Description], [LastEditionDate], [Version], [Creator], [CreationDate], [LastEditor])
	SELECT @FromSerialNumber, @ToSerialNumber, @Amount, @SlID, @IssueDate, @ExpireDate, @Description, @LastEditionDate, 0, @Creator, @CreationDate, @LastEditor
	
	-- Begin Return Select <- do not remove
	SELECT [ShoppingCartID], [Version]
	FROM   [CTM].[ShoppingCart]
	WHERE  [ShoppingCartID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
END
