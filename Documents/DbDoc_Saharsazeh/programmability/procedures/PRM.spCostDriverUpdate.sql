CREATE PROC [PRM].[spCostDriverUpdate]
    @CostDriverID INT,
    @Code INT,
    @Title NVARCHAR(256),
    @Title2 NVARCHAR(256),
    @CostDriverType INT,
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
AS
SET NOCOUNT ON;

IF EXISTS
(
    SELECT 1
    FROM PRM.CostDriver AS cd
    WHERE cd.Code = @Code
          AND cd.CostDriverID <> @CostDriverID
)
BEGIN
    RAISERROR('Code_Duplicated', 16, 12);
    RETURN;
END;

IF EXISTS
(
    SELECT 1
    FROM PRM.CostDriver AS cd
    WHERE cd.Title = @Title
          AND cd.CostDriverID <> @CostDriverID
)
BEGIN
    RAISERROR('Title_Duplicated', 16, 12);
    RETURN;
END;

IF EXISTS
(
    SELECT 1
    FROM PRM.CostDriver AS cd
    WHERE cd.Title2 = @Title2
          AND cd.CostDriverID <> @CostDriverID
)
BEGIN
    RAISERROR('Title2_Duplicated', 16, 12);
    RETURN;
END;



IF @Version =
(
    SELECT [Version]
    FROM [PRM].[CostDriver]
    WHERE [CostDriverID] = @CostDriverID
)
BEGIN

    SET @Version = @Version + 1;

    UPDATE [PRM].[CostDriver]
    SET [Code] = @Code,
        [Title] = @Title,
        [Title2] = @Title2,
        [CostDriverType] = @CostDriverType,
        [Version] = @Version,
        [Creator] = @Creator,
        [CreationDate] = @CreationDate,
        [LastEditor] = @LastEditor,
        [LastEditionDate] = @LastEditionDate
    WHERE [CostDriverID] = @CostDriverID;

    -- Begin Return Select <- do not remove
    SELECT  [Version] 
    FROM [PRM].[CostDriver]
    WHERE [CostDriverID] = @CostDriverID;
-- End Return Select <- do not remove

END;
