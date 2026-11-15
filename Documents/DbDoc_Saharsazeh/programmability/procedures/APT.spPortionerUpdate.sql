CREATE PROC [APT].[spPortionerUpdate]
    @PortionerID int,  	
    @Title nvarchar(256),
    @Title2 nvarchar(256),
    @ApportionGroupID int,
	@ImportanceLevel decimal(20, 10),
	@Priority int,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
SET NOCOUNT ON
	IF EXISTS (SELECT 1 FROM APT.Portioner WHERE Title = @Title AND PortionerID <> @PortionerID)
	BEGIN
		RAISERROR('عنوان نمی تواند تکراری باشد.',16,12)	
		RETURN	
	END  

	IF EXISTS (SELECT 1 FROM APT.Portioner WHERE Title2 = @Title2 AND PortionerID <> @PortionerID)
	BEGIN
		RAISERROR('عنوان2 نمی تواند تکراری باشد.',16,12)	
		RETURN	
	END 

	if @Version=(Select [Version] from APT.Portioner
	where PortionerID = @PortionerID)
	begin	

		set @Version = @Version +1 

		UPDATE APT.Portioner
		SET    Title = @Title, 
			   Title2 = @Title2, 
			   ApportionGroupID = @ApportionGroupID,
			   ImportanceLevel = @ImportanceLevel,
			   [Priority] = @Priority,
			   LastEditor = @LastEditor, 
			   LastEditionDate = @LastEditionDate, 
			   [Version] = @Version
		WHERE  PortionerID = @PortionerID
	
		-- Begin Return Select <- do not remove
		SELECT [Version], Code, [Priority]
		FROM   APT.Portioner
		WHERE  PortionerID = @PortionerID	
		-- End Return Select <- do not remove
	end
	else 
		RAISERROR('Version mismatch...', 16 , 10)
