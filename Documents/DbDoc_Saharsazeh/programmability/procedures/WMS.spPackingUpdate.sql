CREATE     PROC [WMS].[spPackingUpdate]
    @PackingID int,  	
    @Number int,
    @Date date,
	@StockID int,
	@PackingTypeID int,
	@PackingIdentity nvarchar(100),	
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
BEGIN
	SET NOCOUNT ON

	if @Version=(Select [Version] from WMS.Packing
	where PackingID = @PackingID)
	begin	
		set @Version = @Version +1 

		UPDATE WMS.Packing
		SET    Number = @Number,
		       Date = @Date, 
			   StockID = @StockID,
			   PackingTypeID = @PackingTypeID,
			   PackingIdentity = @PackingIdentity,			   
			   LastEditor = @LastEditor, 
			   LastEditionDate = @LastEditionDate, 
			   [Version] = @Version
		WHERE  PackingID = @PackingID
	
		-- Begin Return Select <- do not remove
		SELECT [Version],
				Number
		FROM   WMS.Packing
		WHERE  PackingID = @PackingID
		-- End Return Select <- do not remove
	end
	else 
		RAISERROR('Version mismatch...', 16 , 10)
END
