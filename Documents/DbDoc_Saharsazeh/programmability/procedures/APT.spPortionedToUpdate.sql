
CREATE PROC [APT].[spPortionedToUpdate]
    @PortionedToID int,  	
	@Code int,
    @Title nvarchar(256),
    @Title2 nvarchar(256),
    @ApportionGroupID int,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
SET NOCOUNT ON
	if (@Code is null or @Code = 0)
		set @Code =isnull((select MAX(Code) from APT.PortionedTo),0) + 1

	if @Version=(Select [Version] from APT.PortionedTo
	where PortionedToID = @PortionedToID)
	begin	

		set @Version = @Version +1 

		UPDATE APT.PortionedTo
		SET    Code = @Code,
		       Title = @Title, 
			   Title2 = @Title2, 
			   ApportionGroupID = @ApportionGroupID,		
			   LastEditor = @LastEditor, 
			   LastEditionDate = @LastEditionDate, 
			   [Version] = @Version
		WHERE  PortionedToID = @PortionedToID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version], Code
		FROM   APT.PortionedTo
		WHERE  PortionedToID = @PortionedToID	
		-- End Return Select <- do not remove

	end
	else 
		RAISERROR('Version mismatch...', 16 , 10)
