CREATE   PROC [SLE].[SpPercentagePriceListItemInsert] 
    @PercentagePriceListID int,
    @StuffID int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime 
--WITH ENCRYPTION
AS 
BEGIN
	SET NOCOUNT ON 

	IF EXISTS (SELECT 1 FROM SLE.PriceListItem p WHERE p.StuffID = @StuffID)
	BEGIN
	
		DECLARE @StuffTitle nvarchar(256)
		SELECT @StuffTitle = s.Title 
		FROM STF.[Stuff] s
		WHERE s.StuffID = @StuffID
		RAISERROR('به ازای کالای (%s) اعلامیه قیمت عادی صادر شده است. لذا نمی توان برای این کالا اعلامیه قیمت درصدی صادر کرد.',16,12,@StuffTitle)
	END
	
	INSERT INTO [SLE].[PercentagePriceListItem] ([PercentagePriceListID], [StuffID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @PercentagePriceListID, @StuffID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [PercentagePriceListItemID], [Version]
	FROM   [SLE].[PercentagePriceListItem]
	WHERE  [PercentagePriceListItemID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
END
