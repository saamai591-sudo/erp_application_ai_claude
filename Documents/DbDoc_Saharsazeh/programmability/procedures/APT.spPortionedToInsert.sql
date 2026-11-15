CREATE PROC [APT].[spPortionedToInsert]
    @Code int,
    @Title nvarchar(256),
    @Title2 nvarchar(256),
    @ApportionGroupID int,
    @Creator int,
    @CreationDate datetime
--WITH ENCRYPTION 
AS 
SET NOCOUNT ON 

	if (@Code is null or @Code = 0)
		set @Code =isnull((select MAX(Code) from APT.PortionedTo),0) + 1

	INSERT INTO APT.PortionedTo(Code, Title, Title2, ApportionGroupID, Creator, CreationDate, LastEditor, LastEditionDate, [Version])
	SELECT @Code, @Title, @Title2, @ApportionGroupID, @Creator, @CreationDate, @Creator, @CreationDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT PortionedToID, [Version], Code
	FROM   APT.PortionedTo
	WHERE  PortionedToID = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
