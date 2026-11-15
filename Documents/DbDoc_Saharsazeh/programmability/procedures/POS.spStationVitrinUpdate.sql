CREATE   PROC [POS].[spStationVitrinUpdate]
    @StationVitrinID INT ,
    @StationID INT ,
    @Title NVARCHAR(128) ,
    @IsActive BIT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @Version INT,
	@ViewOrder TINYINT
AS
    SET NOCOUNT ON;

    IF @Version = (   SELECT [Version]
                      FROM   [POS].[StationVitrin]
                      WHERE  [StationVitrinID] = @StationVitrinID )
    BEGIN

        SET @Version = @Version + 1;

        UPDATE [POS].[StationVitrin]
        SET    [StationID] = @StationID ,
                [Title] = @Title ,
                [IsActive] = @IsActive ,
                [Creator] = @Creator ,
                [CreationDate] = @CreationDate ,
                [LastEditor] = @LastEditor ,
                [LastEditionDate] = @LastEditionDate ,
                [Version] = @Version,
				[ViewOrder] = @ViewOrder
        WHERE  [StationVitrinID] = @StationVitrinID;

        -- Begin Return Select <- do not remove
        SELECT  [Version]
        FROM   [POS].[StationVitrin]
        WHERE  [StationVitrinID] = @StationVitrinID;
    -- End Return Select <- do not remove

    END;
    ELSE
        RAISERROR('Version mismatch...', 16, 10);
