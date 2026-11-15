CREATE PROC [APT].[spPortioningUpdate]
    @PortioningID int,	
    @Date date,
    @PortionerID int,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
SET NOCOUNT ON
	IF EXISTS (SELECT 1 FROM APT.Portioning WHERE [Date] = @Date and PortionerID = @PortionerID and
		PortioningID <> @PortioningID)
	BEGIN
		RAISERROR('ترکیب تاریخ اجرا و سهم دهنده نمی تواند تکراری باشد.',16,12)	
		RETURN	
	END  

	if @Version=(Select [Version] from APT.Portioning
	where PortioningID = @PortioningID)
	begin	

		set @Version = @Version +1 

		UPDATE APT.Portioning
		SET    [Date] = @Date, 
			   PortionerID = @PortionerID, 
			   LastEditor = @LastEditor, 
			   LastEditionDate = @LastEditionDate, 
			   [Version] = @Version
		WHERE  PortioningID = @PortioningID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   APT.Portioning
		WHERE  PortioningID = @PortioningID	
		-- End Return Select <- do not remove

	end
	else 
		RAISERROR('Version mismatch...', 16 , 10)
