-------------------------------------
CREATE   PROC [HRM].[spPositionInsert] 
    @Title NVARCHAR(250),
    @Title2 NVARCHAR(250),
    @Code NVARCHAR(50),
    @FlowChartID INT,
    @Specification NVARCHAR(MAX),
    @Specification2 NVARCHAR(MAX),
    @IsManagerToFlowChart BIT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION 
AS 
    SET NOCOUNT ON 
    SET XACT_ABORT ON 

    IF EXISTS(SELECT 1 FROM hrm.Position AS p
	              WHERE code=@Code)
	BEGIN
		RAISERROR('کد تکراري مي باشد.', 16, 12)
        RETURN;
	END
	
    INSERT INTO [HRM].[Position]
      (
        [Title],
        [Title2],
        [FlowChartID],
        [Specification],
        [Specification2],
        [IsManagerToFlowChart],
        Code,
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version]
      )
    SELECT @Title,
           @Title2,
           @FlowChartID,
           @Specification,
           @Specification2,
           @IsManagerToFlowChart,
           @Code,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
           0
	
	-- Begin Return Select <- do not remove
    SELECT [PositionID],
           [Version]
    FROM   [HRM].[Position]
    WHERE  [PositionID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
