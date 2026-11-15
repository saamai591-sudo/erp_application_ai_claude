CREATE     PROC [WMS].[spPhysicalLocationUpdate]
    @PhysicalLocationID int,
    @Number int,
    @Date date,
	@Type tinyint,
	@Contents tinyint,
	@StockID int,
	@SourceWarehouseSpaceDesignID int,
	@WarehouseSpaceDesignID int,	
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
BEGIN
	SET NOCOUNT ON
	
	if @Version=(Select [Version] from WMS.PhysicalLocation
	where PhysicalLocationID = @PhysicalLocationID)
	BEGIN	
		set @Version = @Version +1 

		UPDATE WMS.PhysicalLocation
		SET    Number = @Number,
		       Date = @Date, 
			   Type = @Type,
			   Contents = @Contents,
			   StockID = @StockID,
			   SourceWarehouseSpaceDesignID = @SourceWarehouseSpaceDesignID,
			   WarehouseSpaceDesignID = @WarehouseSpaceDesignID,			   
			   LastEditor = @LastEditor, 
			   LastEditionDate = @LastEditionDate, 
			   [Version] = @Version
		WHERE  PhysicalLocationID = @PhysicalLocationID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version]
		FROM   WMS.PhysicalLocation
		WHERE  PhysicalLocationID = @PhysicalLocationID
		-- End Return Select <- do not remove
	END
	ELSE 
		RAISERROR('Version mismatch...', 16 , 10)
END
