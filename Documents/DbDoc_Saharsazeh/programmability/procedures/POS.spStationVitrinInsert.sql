CREATE   PROC [POS].[spStationVitrinInsert]
    @StationID INT ,
    @Title NVARCHAR(128) ,
    @IsActive BIT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME 
AS
    SET NOCOUNT ON;

	Declare @ViewOrder TINYINT
    SET @ViewOrder = ISNULL((   SELECT MAX(sv.ViewOrder)
                                FROM   POS.StationVitrin AS sv
                                WHERE  sv.StationID = @StationID ) ,
                            0) + 1;

    INSERT INTO [POS].[StationVitrin] ( [StationID] ,
                                        [Title] ,
                                        [IsActive] ,
                                        [Creator] ,
                                        [CreationDate] ,
                                        [LastEditor] ,
                                        [LastEditionDate] ,
                                        [Version] ,
                                        [ViewOrder] )
                SELECT @StationID ,
                       @Title ,
                       @IsActive ,
                       @Creator ,
                       @CreationDate ,
                       @LastEditor ,
                       @LastEditionDate ,
                       0 ,
                       @ViewOrder;

    -- Begin Return Select <- do not remove
    SELECT [StationVitrinID] ,
            [Version],
           [ViewOrder]
    FROM   [POS].[StationVitrin]
    WHERE  [StationVitrinID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove
