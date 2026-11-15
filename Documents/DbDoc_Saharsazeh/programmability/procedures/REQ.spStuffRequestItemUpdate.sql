CREATE     PROC [REQ].[spStuffRequestItemUpdate]
    @StuffRequestItemID INT,
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
    @Version INT,
    @AcceptRequestSubMeasureQuantity DECIMAL(30, 4),
    @RequiredProductID INT,
	@CostCenterID int,
	@RequiredMaterialCostCenterID INT,
	@BaseStuffRequestItemID int,
    @ProjectID INT NULL
--WITH ENCRYPTION
AS
SET NOCOUNT ON;

    DECLARE @StuffCode NVARCHAR(256),
            @PreMainQuantity DECIMAL(30, 4),
            @PreSubQuantity DECIMAL(30, 4),
            @PreVersion INT,
            @PreStuffRequestItemID INT,
            @Message NVARCHAR(MAX);

    SELECT @PreVersion = [Version],
           @PreMainQuantity = MainQuantity,
           @PreSubQuantity = SubQuantity
    FROM [REQ].[StuffRequestItem]
    WHERE [StuffRequestItemID] = @StuffRequestItemID;

    IF @Version <> @PreVersion
        RAISERROR('Version mismatch...', 16, 10);


    IF (@MainQuantity <> @PreMainQuantity)
    BEGIN
        IF
        (
            SELECT REQ.StuffRequestItemHasFlow(@StuffRequestItemID)
        ) = 1
        BEGIN
            SELECT @Message = N'MainQuantityIsNotEditable';


            RAISERROR(@Message, 16, 12);
        --RAISERROR('به دليل گردش اطلاعات، مجاز به ويرايش مقدار اصلي نيستيد.', 16 , 12)
        END;

        UPDATE [REQ].[StuffRequestItem]
        SET [MainQuantity] = @MainQuantity
        WHERE [StuffRequestItemID] = @StuffRequestItemID;
    END;


    IF ISNULL(@SubQuantity, 0) <> ISNULL(@PreSubQuantity, 0)
    BEGIN
        IF
        (
            SELECT REQ.StuffRequestItemHasFlow(@StuffRequestItemID)
        ) = 1
        BEGIN
            SELECT @Message = N'SubQuantityIsNotEditable';


            RAISERROR(@Message, 16, 12);
        --RAISERROR('به دليل گردش اطلاعات، مجاز به ويرايش مقدار فرعی نيستيد.', 16 , 12)
        END;

        UPDATE [REQ].[StuffRequestItem]
        SET [SubQuantity] = @SubQuantity
        WHERE [StuffRequestItemID] = @StuffRequestItemID;
    END;

    UPDATE [REQ].[StuffRequestItem]
    SET [StuffRequestItemIndex] = @StuffRequestItemIndex,
        [StuffID] = @StuffID,
        [Description] = @Description,
        [Description2] = @Description2,
        [AcceptRequestMainMeasureQuantity] = @AcceptRequestMainMeasureQuantity,
        [LastEditor] = @LastEditor,
        [LastEditionDate] = @LastEditionDate,
        [Version] = @Version + 1,
        [AcceptRequestSubMeasureQuantity] = @AcceptRequestSubMeasureQuantity,
        RequiredProductID = @RequiredProductID,
		CostCenterID = @CostCenterID,
		RequiredMaterialCostCenterID = @RequiredMaterialCostCenterID,
		BaseStuffRequestItemID = @BaseStuffRequestItemID,
        [ProjectID]=@ProjectID
    WHERE [StuffRequestItemID] = @StuffRequestItemID;

    -- Begin Return Select <- do not remove
    SELECT  [Version] 
        FROM [REQ].[StuffRequestItem]
    WHERE [StuffRequestItemID] = @StuffRequestItemID;
-- End Return Select <- do not remove
