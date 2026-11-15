CREATE PROC [APT].[spPortioningInsert]
    @Date date,
    @PortionerID int,
    @Creator int,
    @CreationDate datetime
--WITH ENCRYPTION 
AS 
SET NOCOUNT ON 

	IF EXISTS (SELECT 1 FROM APT.Portioning WHERE [Date] = @Date and PortionerID = @PortionerID)
	BEGIN
		RAISERROR('ترکیب تاریخ اجرا و سهم دهنده نمی تواند تکراری باشد.',16,12)	
		RETURN	
	END  


	INSERT INTO APT.Portioning([Date], PortionerID, Creator, CreationDate, LastEditor, LastEditionDate, [Version])
	SELECT @Date, @PortionerID, @Creator, @CreationDate, @Creator, @CreationDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT PortioningID, [Version]
	FROM   APT.Portioning
	WHERE  PortioningID = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
