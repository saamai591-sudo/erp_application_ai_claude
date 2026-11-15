CREATE   PROC [SLE].[SpPercentagePriceListItemUpdate] 
    @PercentagePriceListItemID int,
    @PercentagePriceListID int,
    @StuffID int,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	if @Version <> (Select [Version] from [SLE].[PercentagePriceListItem]
				where [PercentagePriceListItemID] = @PercentagePriceListItemID)
	begin
		RAISERROR('Version mismatch...', 16 , 10)
		return
	end

	set @Version = @Version +1 
	
	IF EXISTS (SELECT * FROM SLE.PriceListItem p WHERE p.StuffID = @StuffID)
	BEGIN
		DECLARE @StuffTitle nvarchar(256)
		SELECT @StuffTitle = s.Title 
		FROM STF.[Stuff] s
		WHERE s.StuffID = @StuffID
		RAISERROR('به ازای کالای (%s) اعلامیه قیمت عادی صادر شده است. لذا نمی توان برای این کالا اعلامیه قیمت درصدی صادر کرد.',16,12,@StuffTitle)
	END

	UPDATE [SLE].[PercentagePriceListItem]
	SET    [PercentagePriceListID] = @PercentagePriceListID, [StuffID] = @StuffID, [Version] = @Version, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate
	WHERE  [PercentagePriceListItemID] = @PercentagePriceListItemID
	
	-- Begin Return Select <- do not remove
	SELECT  [Version] 
    FROM   [SLE].[PercentagePriceListItem]
	WHERE  [PercentagePriceListItemID] = @PercentagePriceListItemID	
	-- End Return Select <- do not remove
