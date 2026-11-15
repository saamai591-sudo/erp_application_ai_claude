CREATE     PROC [REQ].[spStuffRequestItemInsert]
    @StuffRequestID INT,
    @StuffRequestItemIndex INT,
    @StuffID INT,
    @MainQuantity DECIMAL(30, 4),
    @SubQuantity DECIMAL(30, 4),
    @Description NVARCHAR(256),
    @Description2 NVARCHAR(256),
    @AcceptRequestMainMeasureQuantity DECIMAL(30, 4),
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @AcceptRequestSubMeasureQuantity DECIMAL(30, 4),
    @RequiredProductID INT,
	@CostCenterID int,
	@RequiredMaterialCostCenterID INT,
	@BaseStuffRequestItemID INT,
    @ProjectID INT NULL
--WITH ENCRYPTION
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO [REQ].[StuffRequestItem]
    (
        [StuffRequestID],
        [StuffRequestItemIndex],
        [StuffID],
        [MainQuantity],
        [SubQuantity],
        [Description],
        [Description2],
        [AcceptRequestMainMeasureQuantity],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version],
        [AcceptRequestSubMeasureQuantity],
        [RequiredProductID],
		CostCenterID,
		RequiredMaterialCostCenterID,
		BaseStuffRequestItemID,
        [ProjectID]
    )
    SELECT @StuffRequestID,
           @StuffRequestItemIndex,
           @StuffID,
           @MainQuantity,
           @SubQuantity,
           @Description,
           @Description2,
           @AcceptRequestMainMeasureQuantity,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
           0,
           @AcceptRequestSubMeasureQuantity,
           @RequiredProductID,
		   @CostCenterID,
		   @RequiredMaterialCostCenterID,
		   @BaseStuffRequestItemID,
           @ProjectID

    -- Begin Return Select <- do not remove
    SELECT [StuffRequestItemID],
           [Version]
    FROM [REQ].[StuffRequestItem]
    WHERE [StuffRequestItemID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove

END;
